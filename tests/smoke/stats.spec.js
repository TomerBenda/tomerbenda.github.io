const { test, expect } = require("@playwright/test");
const { phosphorPage } = require("../helpers");

const CORS = { "Access-Control-Allow-Origin": "*" };

test("stats: auth gate, summary, charts, sortable table", async ({ page, request }) => {
  const errors = await phosphorPage(page);
  await page.route("https://tbd-spotify.tomerno6.workers.dev/**", (r) => r.abort());

  const index = await (await request.get("/posts/index.json")).json();
  const k = (f) => f.split("/").pop().replace(/\.[^.]+$/, "");
  const views = {};
  views[k(index[0].filename)] = 40;
  views[k(index[1].filename)] = 25;
  const reactions = {};
  reactions[k(index[0].filename)] = { "❤️": 3, "👍": 2 };

  await page.route("https://tbd-blog-view-counter.tomerno6.workers.dev/all", (r) =>
    r.fulfill({ json: views, headers: CORS })
  );
  await page.route("https://tbd-blog-view-counter.tomerno6.workers.dev/history", (r) =>
    r.fulfill({ json: { "2026-07-01": 40, "2026-07-04": 52, "2026-07-07": 65 }, headers: CORS })
  );
  await page.route("https://tbd-blog-post-reactions.tomerno6.workers.dev/reactions/all", (r) =>
    r.fulfill({ json: reactions, headers: CORS })
  );

  await page.goto("/stats.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#auth-screen")).toBeVisible();
  await page.fill("#token-input", "letmein");
  await page.press("#token-input", "Enter");

  await expect(page.locator("#dashboard")).toBeVisible();
  await expect(page.locator("#auth-screen")).toBeHidden(); // ID-specificity regression guard
  await expect(page.locator("#summary")).toContainText("65 total reads");
  // Charts render: categories, post-months, emoji bars + history line
  await expect(page.locator("#chart-categories .hbar-row").first()).toBeVisible();
  await expect(page.locator("#chart-months .hbar-row").first()).toBeVisible();
  await expect(page.locator("#chart-emoji .hbar-row").first()).toBeVisible();
  await expect(page.locator("#chart-history .spark-svg")).toBeVisible();
  await expect(page.locator("#chart-history .spark-caption")).toContainText("65 reads");
  // Table renders every post; top row is the most-viewed
  await expect(page.locator("#stats-tbody tr")).toHaveCount(index.length);
  await expect(page.locator("#stats-tbody tr").first()).toContainText("40");
  // Palette button exists here too (page is fully wired now)
  await expect(page.locator(".nav-term-btn")).toBeVisible();
  expect(errors).toEqual([]);
});

test("stats: wrong passphrase is rejected; history absent degrades", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.route("https://tbd-spotify.tomerno6.workers.dev/**", (r) => r.abort());
  await page.route("https://tbd-blog-view-counter.tomerno6.workers.dev/all", (r) =>
    r.fulfill({ status: 401, json: { error: "unauthorized" }, headers: CORS })
  );
  await page.route("https://tbd-blog-view-counter.tomerno6.workers.dev/history", (r) =>
    r.fulfill({ status: 401, json: { error: "unauthorized" }, headers: CORS })
  );
  await page.route("https://tbd-blog-post-reactions.tomerno6.workers.dev/reactions/all", (r) =>
    r.fulfill({ status: 401, json: { error: "unauthorized" }, headers: CORS })
  );
  await page.goto("/stats.html", { waitUntil: "domcontentloaded" });
  await page.fill("#token-input", "wrong");
  await page.press("#token-input", "Enter");
  await expect(page.locator("#auth-error")).toContainText("access denied");
  await expect(page.locator("#dashboard")).toBeHidden();
  expect(errors).toEqual([]);
});
