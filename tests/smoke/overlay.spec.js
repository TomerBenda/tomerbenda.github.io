const { test, expect } = require("@playwright/test");
const { phosphorPage } = require("../helpers");

test("Ctrl+K palette: search, navigate-errors, esc", async ({ page, request }) => {
  const errors = await phosphorPage(page);
  await page.route("https://tbd-spotify.tomerno6.workers.dev/**", (r) => r.abort());
  const index = await (await request.get("/posts/index.json")).json();
  const word = (index[0].title || index[0].filename).split(/\s+/)[0];

  await page.goto("/travel.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("header nav", { timeout: 10000 });

  await page.keyboard.press("Control+k");
  await expect(page.locator(".term-overlay-backdrop")).toHaveClass(/open/);

  const type = async (cmd) => {
    await page.fill(".term-overlay .term-input", cmd);
    await page.press(".term-overlay .term-input", "Enter");
  };
  await type("grep " + word);
  await expect(page.locator(".term-grep-hit").first()).toBeVisible();
  await expect(page.locator(".term-grep-hit a").first()).toHaveAttribute("href", /blog\?post=/);

  await type("cd nosuchpage");
  await expect(page.locator(".term-overlay .term-line.term-err").last()).toContainText("cd: no such directory");

  await page.keyboard.press("Escape");
  await expect(page.locator(".term-overlay-backdrop")).not.toHaveClass(/open/);
  expect(errors).toEqual([]);
});

test("the >_ nav button opens the palette on every page", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.route("https://tbd-spotify.tomerno6.workers.dev/**", (r) => r.abort());
  await page.route("https://api.github.com/repos/**", (r) => r.fulfill({ json: {} }));
  await page.route("https://raw.githubusercontent.com/**", (r) => r.abort());
  for (const path of ["/", "/blog.html", "/music.html", "/projects.html"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".nav-term-btn", { timeout: 10000 });
    await page.click(".nav-term-btn");
    await expect(page.locator(".term-overlay-backdrop")).toHaveClass(/open/);
    await page.keyboard.press("Escape");
  }
  expect(errors).toEqual([]);
});
