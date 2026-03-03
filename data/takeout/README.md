# Google Takeout Location History input


# NO LONGER WORKS - Data should be exported from mobile device settings


https://takeout.google.com/settings/takeout/custom/location_history

Place your Google Takeout Location History export here so the daily workflow can update `posts/timeline.json`.

**Option A – Records (raw points)**  
- Put `Records.json` in this folder (from Takeout: **Location History** → **Records.json**).

**Option B – Semantic Location History**  
- Put the `Semantic Location History` folder here (monthly JSON files like `2021_JANUARY.json`).

The script `scripts/takeout_to_timeline.py` reads both. You can add one or both.

If this folder is empty, the workflow will run but leave `timeline.json` unchanged (or empty).
