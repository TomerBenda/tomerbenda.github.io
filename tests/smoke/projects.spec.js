const { test, expect } = require("@playwright/test");
const { phosphorPage } = require("../helpers");

test("projects terminal boots, lists, cats", async ({ page, request }) => {
  const errors = await phosphorPage(page);
  await page.route("https://api.github.com/repos/**", (r) =>
    r.fulfill({ json: { stargazers_count: 7 } })
  );
  const index = await (await request.get("/projects/index.json")).json();
  await page.goto("/projects.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".proj-open", { timeout: 15000 });
  await expect(page.locator(".proj-open")).toHaveCount(index.length);
  await page.locator(".proj-open").first().click();
  await expect(page.locator(".term-scrollback")).toContainText(index[0].blurb.slice(0, 25));
  await page.fill("#term-input", "frobnicate");
  await page.press("#term-input", "Enter");
  await expect(page.locator(".term-line.term-err").last()).toContainText("command not found");
  expect(errors).toEqual([]);
});
