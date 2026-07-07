const { test, expect } = require("@playwright/test");
const { phosphorPage } = require("../helpers");

test("map renders: country routes, curved crossings, no black pulse", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.goto("/travel.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".leaflet-marker-icon", { timeout: 20000 });
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const paths = Array.from(document.querySelectorAll(".leaflet-overlay-pane path"));
    const ant = paths.filter((el) => (el.getAttribute("class") || "").includes("ant-path"));
    return {
      ant: ant.length,
      curved: ant.filter((el) => (el.getAttribute("d") || "").split("L").length >= 8).length,
      black: ant.filter((el) => ["#000", "#000000", "black"].includes(el.getAttribute("stroke"))).length,
    };
  });
  expect(r.ant).toBeGreaterThan(0);
  expect(r.curved).toBe(r.ant);
  expect(r.black).toBe(0);
  await expect(page.locator("#journey-stats")).toContainText("countries");
  await expect(page.locator(".journey-chip")).toHaveCount(0); // single trip: no selector
  expect(errors).toEqual([]);
});

test("replay never loads tiles and stops cleanly", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.goto("/travel.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#journey-replay", { timeout: 20000 });
  await page.waitForSelector(".leaflet-marker-icon", { timeout: 20000 });
  await page.waitForTimeout(2500);
  let tiles = 0;
  page.on("request", (r) => { if (r.url().includes("basemaps.cartocdn.com")) tiles++; });
  await page.click("#journey-replay");
  await page.waitForTimeout(5000);
  await expect(page.locator("#journey-replay-hud")).not.toHaveText("");
  expect(tiles).toBe(0);
  await page.click("#journey-replay"); // stop
  await expect(page.locator("#journey-replay")).toContainText("replay journey");
  expect(errors).toEqual([]);
});

test("marker popups carry the day's song", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.route("**/posts/index.json", async (route) => {
    const res = await route.fetch();
    const posts = await res.json();
    posts.push({
      filename: "Polarsteps/Israel/999_haifa.md",
      title: "Day 999 - Haifa",
      date: "2027-01-01 10:00",
      categories: ["travel", "Israel"],
      song_of_the_day: "Karma Police - Radiohead",
    });
    await route.fulfill({ response: res, json: posts });
  });
  await page.route("**/posts/locations.json", async (route) => {
    const res = await route.fetch();
    const loc = await res.json();
    loc["Polarsteps/Israel/999_haifa.md"] = { lat: 32.79, lng: 34.98 };
    await route.fulfill({ response: res, json: loc });
  });
  await page.goto("/travel.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".travel-marker-current", { timeout: 20000 });
  await page.locator(".travel-marker-current").click();
  await expect(page.locator(".leaflet-popup")).toContainText("Day 999 - Haifa");
  await expect(page.locator(".leaflet-popup .travel-popup-song")).toContainText("Karma Police");
  expect(errors).toEqual([]);
});

test("second trip gets chips and disconnected routes", async ({ page }) => {
  const errors = await phosphorPage(page);
  await page.route("**/posts/index.json", async (route) => {
    const res = await route.fetch();
    const posts = await res.json();
    posts.push(
      { filename: "TestTrip/Peru/1_cusco.md", title: "Day 1 - Cusco", date: "2027-03-01 10:00", categories: ["travel", "Peru"] },
      { filename: "TestTrip/Peru/2_lima.md", title: "Day 4 - Lima", date: "2027-03-04 10:00", categories: ["travel", "Peru"] }
    );
    await route.fulfill({ response: res, json: posts });
  });
  await page.route("**/posts/locations.json", async (route) => {
    const res = await route.fetch();
    const loc = await res.json();
    loc["TestTrip/Peru/1_cusco.md"] = { lat: -13.53, lng: -71.97 };
    loc["TestTrip/Peru/2_lima.md"] = { lat: -12.05, lng: -77.04 };
    await route.fulfill({ response: res, json: loc });
  });
  await page.goto("/travel.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".journey-chip", { timeout: 20000 });
  await expect(page.locator(".journey-chip")).toHaveCount(3); // all + 2 trips
  await page.click('.journey-chip[data-trip="testtrip"]');
  // km within the fixture trip only — proves no line connects Israel to Peru
  await expect(page.locator("#journey-stats")).toContainText("~574 km");
  expect(errors).toEqual([]);
});
