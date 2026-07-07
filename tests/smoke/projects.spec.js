const { test, expect } = require("@playwright/test");
const { phosphorPage } = require("../helpers");

test("projects terminal boots, lists, cats", async ({ page, request }) => {
  const errors = await phosphorPage(page);
  await page.route("https://api.github.com/repos/**", (r) =>
    r.fulfill({ json: { stargazers_count: 7 } })
  );
  await page.route("https://raw.githubusercontent.com/**", (r) => r.abort());
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

test("cat renders the repo README, and survives its absence", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.route("https://api.github.com/repos/**", (r) => r.fulfill({ json: { stargazers_count: 1 } }));
  await page.route("https://raw.githubusercontent.com/**", (r) =>
    r.fulfill({
      body: "# Fixture Readme\n\nsome **real** readme prose.",
      contentType: "text/plain",
      headers: { "Access-Control-Allow-Origin": "*" },
    })
  );
  await page.goto("/projects.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".proj-open", { timeout: 15000 });
  await page.locator(".proj-open").first().click();
  // README is gated behind a [y/N] prompt
  await expect(page.locator(".term-scrollback")).toContainText("README.md? [");
  await expect(page.locator(".term-cat-body")).toHaveCount(0);
  await page.fill("#term-input", "y");
  await page.press("#term-input", "Enter");
  await expect(page.locator(".term-cat-body h1")).toContainText("Fixture Readme");
  await expect(page.locator(".term-cat-body")).toContainText("readme prose");
  expect(errors).toEqual([]);
});

test("declining or ignoring the README offer keeps the session flowing", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.route("https://api.github.com/repos/**", (r) => r.fulfill({ json: { stargazers_count: 1 } }));
  await page.route("https://raw.githubusercontent.com/**", (r) =>
    r.fulfill({ body: "# Fixture Readme", contentType: "text/plain", headers: { "Access-Control-Allow-Origin": "*" } })
  );
  await page.goto("/projects.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".proj-open", { timeout: 15000 });
  await page.locator(".proj-open").first().click();
  await page.fill("#term-input", "n");
  await page.press("#term-input", "Enter");
  await expect(page.locator(".term-scrollback")).toContainText("(skipped)");
  await expect(page.locator(".term-cat-body")).toHaveCount(0);
  // A different command while the offer is pending cancels it and just runs
  await page.locator(".proj-open").first().click();
  await page.fill("#term-input", "help");
  await page.press("#term-input", "Enter");
  await expect(page.locator(".term-scrollback")).toContainText("available commands");
  await expect(page.locator(".term-cat-body")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("cat falls back to the blurb when the README is unreachable", async ({ page, request }) => {
  const errors = await phosphorPage(page);
  await page.route("https://api.github.com/repos/**", (r) => r.fulfill({ json: { stargazers_count: 1 } }));
  await page.route("https://raw.githubusercontent.com/**", (r) => r.abort());
  const index = await (await request.get("/projects/index.json")).json();
  await page.goto("/projects.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".proj-open", { timeout: 15000 });
  await page.locator(".proj-open").first().click();
  await expect(page.locator(".term-scrollback")).toContainText(index[0].blurb.slice(0, 25));
  await page.fill("#term-input", "y");
  await page.press("#term-input", "Enter");
  await expect(page.locator(".term-scrollback")).toContainText("could not read");
  await expect(page.locator(".term-cat-body")).toHaveCount(0);
  expect(errors).toEqual([]);
});
