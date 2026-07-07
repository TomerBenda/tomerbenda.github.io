const { test, expect } = require("@playwright/test");
const { phosphorPage } = require("../helpers");

test("blog list renders with neon chrome", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.goto("/blog.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".post-window");
  const border = await page.$eval(".post-window", (el) => getComputedStyle(el).borderTopWidth);
  expect(border).toBe("2px");
  expect(errors).toEqual([]);
});

test("a full post renders responsive images", async ({ page, request }) => {
  const errors = await phosphorPage(page);
  const manifest = await (await request.get("/assets/img/manifest.json")).json();
  const index = await (await request.get("/posts/index.json")).json();
  const dirs = [...new Set(Object.keys(manifest).map((k) => k.split("/attachments/")[0]))];
  // Find a post living in a dir that has processed images
  const candidates = index.filter((p) => dirs.some((d) => p.filename.startsWith(d + "/")));
  expect(candidates.length).toBeGreaterThan(0);
  let found = false;
  for (const post of candidates.slice(0, 6)) {
    await page.goto("/blog.html?post=" + encodeURIComponent(post.filename), { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".post-full", { timeout: 15000 });
    if ((await page.locator(".post-full img[srcset]").count()) > 0) { found = true; break; }
  }
  expect(found).toBe(true);
  const img = page.locator(".post-full img[srcset]").first();
  await expect(img).toHaveAttribute("width", /\d+/);
  expect(errors).toEqual([]);
});
