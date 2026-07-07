// Shared page setup: collect page errors, abort OneSignal (its CDN hangs
// headless Chromium and its deferred script would block DOMContentLoaded).
async function phosphorPage(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // NB: protocol-explicit glob — with a baseURL configured, protocol-less
  // patterns get resolved against it and never match cross-origin URLs.
  await page.route("https://cdn.onesignal.com/**", (r) => r.abort());
  return errors;
}

// Type a command into a terminal input and submit it
async function typeCmd(page, cmd, selector = "#term-input", settle = 300) {
  await page.fill(selector, cmd);
  await page.press(selector, "Enter");
  await page.waitForTimeout(settle);
}

module.exports = { phosphorPage, typeCmd };
