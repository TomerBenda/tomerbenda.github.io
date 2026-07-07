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
  expect(errors).toEqual([]);
});
