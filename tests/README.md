# Smoke tests

Playwright suite covering all five pages; runs in CI on every PR and push
to main (`.github/workflows/smoke.yaml`).

Run locally:

```bash
cd tests
npm ci
npx playwright install chromium
npm test
```

The config starts `python -m http.server 8080` from the repo root by itself
and reuses an already-running server on :8080 if you have one.

Specs are data-resilient by design: they discover posts, project counts,
and Hebrew/Latin rows dynamically (the vault sync rewrites content daily),
and they mock external services (Discogs data, GitHub API, the spotify
worker). OneSignal is route-aborted in every spec — its CDN hangs headless
Chromium.
