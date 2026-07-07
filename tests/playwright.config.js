const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./smoke",
  timeout: 60000,
  retries: 1,
  use: {
    baseURL: "http://127.0.0.1:8080",
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "python -m http.server 8080",
    cwd: "..",
    url: "http://127.0.0.1:8080/",
    reuseExistingServer: true,
    timeout: 15000,
  },
});
