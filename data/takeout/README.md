# Google Timeline input (local only — never committed)

⚠️ **Raw location exports are personal data and are gitignored. Do not commit them.**
The public artifact is `posts/timeline.json` — bounded, per-day points that mirror
what the travel posts already publish.

## Updating the travel timeline

1. On your phone: Google Maps → your avatar → **Your Timeline** → ⚙️ →
   **Location & privacy settings** → **Export Timeline data**.
   (The old takeout.google.com flow no longer includes Timeline.)
2. Put the export at `data/takeout/Timeline.json` (semanticSegments format).
3. From the repo root run:

   ```
   python scripts/takeout_to_timeline.py
   ```

4. Commit **only** `posts/timeline.json`.

The travel map matches timeline points to posts by date; days without a travel post
still draw route detail but link nowhere.
