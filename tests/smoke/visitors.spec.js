const { test, expect } = require("@playwright/test");
const { phosphorPage, typeCmd } = require("../helpers");

const V = "https://tbd-visitors.tomerno6.workers.dev";
const CORS = { "Access-Control-Allow-Origin": "*" };

function mockVisitors(page, { here = 3, messages, meltdown } = {}) {
  return Promise.all([
    page.route(V + "/wall", (r) => {
      if (r.request().method() === "POST") {
        const text = JSON.parse(r.request().postData() || "{}").text || "";
        if (text.includes("ratelimitme")) return r.fulfill({ status: 429, json: { error: "rate limited" }, headers: CORS });
        return r.fulfill({ json: { ok: true }, headers: CORS });
      }
      return r.fulfill({
        json: { messages: messages || [{ text: "hello from berlin", ts: 1751900000000 }] },
        headers: CORS,
      });
    }),
    page.route(V + "/presence", (r) => r.fulfill({ json: { here }, headers: CORS })),
    page.route(V + "/meltdown", (r) =>
      r.fulfill({ json: meltdown || { attempts: 1247, vandals: 88 }, headers: CORS })
    ),
  ]);
}

test("the wall: read, write, rate-limit", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.route("https://tbd-spotify.tomerno6.workers.dev/**", (r) => r.abort());
  await mockVisitors(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#term-input");
  await typeCmd(page, "wall");
  await expect(page.locator(".term-scrollback")).toContainText("hello from berlin");
  await typeCmd(page, "wall greetings from the suite");
  await expect(page.locator(".term-scrollback")).toContainText("posted. the wall remembers.");
  await typeCmd(page, "wall ratelimitme");
  await expect(page.locator(".term-scrollback")).toContainText("needs a breather");
  expect(errors).toEqual([]);
});

test("MOTD gains presence and the latest wall line", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.route("https://tbd-spotify.tomerno6.workers.dev/**", (r) => r.abort());
  await mockVisitors(page, { here: 3 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#motd.visible", { timeout: 15000 });
  await expect(page.locator("#motd")).toContainText("3 on the site right now");
  await expect(page.locator("#motd")).toContainText("the wall");
  await expect(page.locator("#motd")).toContainText("hello from berlin");
  expect(errors).toEqual([]);
});

test("meltdown reports the global tally", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.route("https://tbd-spotify.tomerno6.workers.dev/**", (r) => r.abort());
  await mockVisitors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#term-input");
  await typeCmd(page, "rm -rf --no-preserve-root /", "#term-input", 600);
  await expect(page.locator(".term-scrollback")).toContainText("attempt #1 for you, #1,247 globally");
  await expect(page.locator(".term-scrollback")).toContainText("one of 88 vandals");
  expect(errors).toEqual([]);
});

test("everything degrades when the visitors worker is silent", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.route("https://tbd-spotify.tomerno6.workers.dev/**", (r) => r.abort());
  await page.route(V + "/**", (r) => r.abort());
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#term-input");
  await typeCmd(page, "wall");
  await expect(page.locator(".term-scrollback")).toContainText("the wall is unreachable");
  await typeCmd(page, "rm -rf --no-preserve-root /", "#term-input", 600);
  await expect(page.locator(".term-scrollback")).toContainText("attempt #1 for you. the site remembers.");
  await page.waitForSelector("#motd.visible", { timeout: 15000 });
  await expect(page.locator("#motd")).not.toContainText("the wall");
  await expect(page.locator("#motd")).not.toContainText("right now");
  expect(errors).toEqual([]);
});
