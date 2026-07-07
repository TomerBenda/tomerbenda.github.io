// Shared page setup: collect page errors, abort OneSignal (its CDN hangs
// headless Chromium and its deferred script would block DOMContentLoaded).
async function phosphorPage(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**cdn.onesignal.com**", (r) => r.abort());
  return errors;
}

module.exports = { phosphorPage };
