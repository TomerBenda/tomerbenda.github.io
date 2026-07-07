const { test, expect } = require("@playwright/test");
const { phosphorPage } = require("../helpers");

const MOCK_VINYL = [
  { id: 1, title: "In Rainbows", artist: "Radiohead", year: 2007, genres: ["Rock"], cover: null },
  { id: 2, title: "Kind of Blue", artist: "Miles Davis", year: 1959, genres: ["Jazz"], cover: null },
];

test("log rows share columns across scripts (bidi)", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.route("**tbd-spotify**", (r) => r.abort());
  await page.goto("/music.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".song-log-row");
  const geo = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll(".song-log-row"));
    const heb = /[֐-׿]/;
    const pick = (fn) => rows.find((r) => fn(r.querySelector(".song-log-title").textContent));
    const targets = [pick((t) => heb.test(t)), pick((t) => !heb.test(t))].filter(Boolean);
    return targets.map((row) => {
      const x = (sel) => Math.round(row.querySelector(sel).getBoundingClientRect().x);
      return { date: x(".song-log-date"), play: x(".song-log-play"), title: x(".song-log-title"), link: x(".song-log-link") };
    });
  });
  expect(geo.length).toBeGreaterThan(0);
  for (const g of geo) {
    expect(g.date).toBeLessThan(g.play);
    expect(g.play).toBeLessThan(g.title);
    expect(g.title).toBeLessThan(g.link);
  }
  // All titles bidi-isolated
  const rows = await page.locator(".song-log-row").count();
  await expect(page.locator(".song-log-title bdi")).toHaveCount(rows);
  expect(errors).toEqual([]);
});

test("vinyl shelf renders from data and hides without it", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.route("**tbd-spotify**", (r) => r.abort());
  await page.route("**/data/discogs.json", (r) => r.fulfill({ json: MOCK_VINYL }));
  await page.goto("/music.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".vinyl-card");
  await expect(page.locator(".vinyl-card")).toHaveCount(2);
  await expect(page.locator("a.vinyl-card").first()).toHaveAttribute("href", /discogs\.com\/release\/1/);
  // now-playing stays hidden when the worker is unreachable
  await expect(page.locator("#now-playing")).toHaveClass(/hidden/);
  // the log scrolls in place
  const scrolls = await page.$eval(".song-log", (el) => el.scrollHeight > el.clientHeight);
  expect(scrolls).toBe(true);
  expect(errors).toEqual([]);
});
