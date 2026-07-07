const { test, expect } = require("@playwright/test");
const { phosphorPage } = require("../helpers");

test("home terminal responds to commands", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#term-input");
  const type = async (cmd) => {
    await page.fill("#term-input", cmd);
    await page.press("#term-input", "Enter");
    await page.waitForTimeout(300);
  };
  await type("help");
  await type("ls");
  await type("nosuchcmd");
  await expect(page.locator(".term-dir")).toHaveCount(5); // ls pages
  await expect(page.locator(".term-line.term-err").last()).toContainText("command not found: nosuchcmd");
  // Navigation is consolidated under cd (no per-page commands in help)
  await type("cd");
  await expect(page.locator(".term-scrollback")).toContainText("you're home.");
  await type("cd ..");
  await expect(page.locator(".term-scrollback")).toContainText("this is the top");
  await type("cd nosuchpage");
  await expect(page.locator(".term-line.term-err").last()).toContainText("cd: no such directory: nosuchpage");
  // Highlighted command mentions are clickable (e.g. `ls` in the cd error)
  await page.locator(".term-cmd", { hasText: "ls" }).last().click();
  await expect(page.locator(".term-dir")).toHaveCount(10); // second ls output
  expect(errors).toEqual([]);
});

test("MOTD strip and `now` command surface living signals", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.route("https://tbd-spotify.tomerno6.workers.dev/**", (r) =>
    r.fulfill({
      json: { playing: true, track: "Everything In Its Right Place", artist: "Radiohead", url: "https://open.spotify.com/track/x" },
      headers: { "Access-Control-Allow-Origin": "*" }, // cross-origin fulfill needs explicit CORS
    })
  );
  await page.route("**/data/songlog.json", (r) =>
    r.fulfill({ json: { tracks: [{ date: "2026-07-01", song: "Pyramid Song - Radiohead", url: "https://open.spotify.com/track/a", month: "2026-07" }] } })
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#motd.visible", { timeout: 15000 });
  const labels = await page.$$eval("#motd .term-motd-label", (els) => els.map((e) => e.textContent));
  expect(labels.join(" ")).toContain("now playing");
  expect(labels.join(" ")).toContain("latest track");
  expect(labels.join(" ")).toContain("last seen");
  // `now` prints the same signals into the scrollback
  await page.fill("#term-input", "now");
  await page.press("#term-input", "Enter");
  await expect(page.locator(".term-scrollback")).toContainText("now playing", { timeout: 10000 });
  await expect(page.locator(".term-scrollback")).toContainText("Radiohead — Everything In Its Right Place");
  expect(errors).toEqual([]);
});

test("MOTD stays hidden when every source is silent", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.route("https://tbd-spotify.tomerno6.workers.dev/**", (r) => r.abort());
  await page.route("**/data/songlog.json", (r) => r.fulfill({ status: 404, body: "" }));
  await page.route("**/data/discogs.json", (r) => r.fulfill({ status: 404, body: "" }));
  await page.route("**/posts/index.json", (r) => r.fulfill({ json: [] }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#term-input");
  await page.waitForTimeout(3500);
  await expect(page.locator("#motd")).not.toHaveClass(/visible/);
  expect(errors).toEqual([]);
});
