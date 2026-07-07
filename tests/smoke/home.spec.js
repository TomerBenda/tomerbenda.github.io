const { test, expect } = require("@playwright/test");
const { phosphorPage, typeCmd } = require("../helpers");

test("home terminal responds to commands", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#term-input");
  const type = (cmd) => typeCmd(page, cmd);
  await type("help");
  await type("ls");
  await type("nosuchcmd");
  await expect(page.locator(".term-dir")).toHaveCount(4); // ls rows (stats stays unlisted)
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
  await expect(page.locator(".term-dir")).toHaveCount(8); // second ls output
  expect(errors).toEqual([]);
});

test("rm -rf / asks first, declines gracefully, and the show ends fine", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.route("https://tbd-spotify.tomerno6.workers.dev/**", (r) => r.abort());
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#term-input");
  const type = (cmd) => typeCmd(page, cmd);
  await type("rm -rf /");
  await expect(page.locator(".term-scrollback")).toContainText("remove write-protected system directory");
  await type("n");
  await expect(page.locator(".term-scrollback")).toContainText("wise.");
  await type("sudo rm -rf /");
  await expect(page.locator(".term-scrollback")).toContainText("absolutely not");
  // The connoisseur flag skips the prompt; reduced motion gets the quiet apocalypse
  await type("rm -rf --no-preserve-root /");
  await expect(page.locator(".term-scrollback")).toContainText("everything is fine. nothing was lost.");
  await expect(page.locator(".term-scrollback")).toContainText("attempt #1");
  await type("vim");
  await expect(page.locator(".term-scrollback")).toContainText("protecting you");
  expect(errors).toEqual([]);
});

test("the archive is a filesystem: ls paths, post census", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.route("https://tbd-spotify.tomerno6.workers.dev/**", (r) => r.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#term-input");
  const type = (cmd) => typeCmd(page, cmd);
  await type("ls");
  await expect(page.locator(".term-scrollback")).toContainText("posts");
  await expect(page.locator(".term-scrollback")).toContainText("trip ·");
  await expect(page.locator(".term-scrollback")).not.toContainText("stats"); // private page stays unlisted
  await expect(page.locator(".footer-nav")).toHaveCount(0); // vetoed duplicate nav
  await type("ls blog");
  await expect(page.locator(".term-scrollback")).toContainText("travel/");
  await type("ls trips");
  await expect(page.locator(".term-scrollback")).toContainText("the big trip/");
  await expect(page.locator(".term-scrollback")).toContainText("212 days");
  await type("ls trips/big-trip");
  await expect(page.locator(".term-scrollback")).toContainText("japan/");
  await type("ls blog/tech");
  await expect(page.locator(".term-scrollback .term-line", { hasText: /2\d{3}-\d{2}-\d{2}/ }).last()).toBeVisible();
  await type("ls nosuchdir");
  await expect(page.locator(".term-line.term-err").last()).toContainText("no such directory");
  await type("post");
  await expect(page.locator(".term-scrollback")).toContainText("posts: ");
  await expect(page.locator(".term-scrollback")).toContainText("travel");
  await type("post today");
  await type("post shuffle");
  await expect(page.locator(".term-scrollback .term-line", { hasText: "──" }).last()).toBeVisible();
  expect(errors).toEqual([]);
});

test("day cards join posts, song, and nav for a date", async ({ page, request }) => {
  const errors = await phosphorPage(page);
  await page.route("https://tbd-spotify.tomerno6.workers.dev/**", (r) => r.abort());
  const index = await (await request.get("/posts/index.json")).json();
  const withSong = index.find((p) => p.song_of_the_day && /^Day\s+\d+/i.test(p.title || ""));
  const date = withSong.date.split(" ")[0];
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#term-input");
  await page.fill("#term-input", "day " + date);
  await page.press("#term-input", "Enter");
  await expect(page.locator(".term-scrollback")).toContainText("── day");
  await expect(page.locator(".term-scrollback")).toContainText(withSong.title.slice(0, 15));
  await expect(page.locator(".term-scrollback")).toContainText("♪");
  await expect(page.locator(".term-cmd", { hasText: "shuffle" }).first()).toBeVisible();
  // shuffle prints another card
  await page.fill("#term-input", "shuffle");
  await page.press("#term-input", "Enter");
  await expect(page.locator(".term-scrollback .term-line", { hasText: "──" }).nth(1)).toBeVisible();
  expect(errors).toEqual([]);
});

test("on this day surfaces year-old posts in the MOTD", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.route("https://tbd-spotify.tomerno6.workers.dev/**", (r) => r.abort());
  const today = new Date();
  const lastYear = `${today.getFullYear() - 1}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  await page.route("**/posts/index.json", async (route) => {
    const res = await route.fetch();
    const posts = await res.json();
    posts.push({ filename: "Tech/memory_lane.md", title: "A Year-Old Memory", date: lastYear + " 12:00", categories: ["tech"] });
    await route.fulfill({ response: res, json: posts });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#motd.visible", { timeout: 15000 });
  await expect(page.locator("#motd")).toContainText("on this day");
  await expect(page.locator("#motd")).toContainText("A Year-Old Memory");
  expect(errors).toEqual([]);
});

test("grep works in the home terminal (shared command set)", async ({ page, request }) => {
  const errors = await phosphorPage(page);
  await page.route("https://tbd-spotify.tomerno6.workers.dev/**", (r) => r.abort());
  const index = await (await request.get("/posts/index.json")).json();
  const word = (index[0].title || index[0].filename).split(/\s+/)[0];
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#term-input");
  await page.fill("#term-input", "grep " + word);
  await page.press("#term-input", "Enter");
  await expect(page.locator(".term-grep-hit").first()).toBeVisible();
  await expect(page.locator(".term-grep-hit a").first()).toHaveAttribute("href", /blog\?post=/);
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
