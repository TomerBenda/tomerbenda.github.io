# Google Timeline integration

## Overview

- **Timeline data** (from Google Takeout) → `posts/timeline.json`. Matched to posts by **date**; timeline points for a given day link to that day’s travel post.
- **Manual / pre-timeline locations** → `posts/locations.json` only. No new “generated” entries after integration; existing generated data keeps placeholder fields for missing info.
- **Priority**: When both exist for a day, timeline data is used for rendering; locations.json remains the manual override store for post-keyed pins.

## File formats

### `posts/timeline.json`

Array of point objects. Each point is one location from Takeout, normalized for the map.

**Required:**

| Field      | Type   | Description |
|-----------|--------|-------------|
| `lat`     | number | WGS84 latitude |
| `lng`     | number | WGS84 longitude |
| `date`    | string | `YYYY-MM-DD` for matching to posts |
| `timestamp` | string | ISO 8601 (e.g. `2022-03-03T12:27:48Z`) |

**Optional (from Takeout when present):**

- `accuracy` / `accuracyMeters` – meters
- `placeId` – Google Place ID
- `address` – string
- `name` – place name
- `activityType` – e.g. `WALKING`, `IN_VEHICLE`
- `source` – `"Records"` (raw) or `"Semantic"` (activity/place visit)
- `velocity` – m/s (Records)
- `heading` – degrees (Records)

Example:

```json
[
  {
    "lat": 1.3521,
    "lng": 103.8198,
    "date": "2026-01-09",
    "timestamp": "2026-01-09T01:51:00.000Z",
    "accuracy": 20,
    "placeId": "ChIJ...",
    "address": "Singapore",
    "name": null,
    "activityType": "STILL",
    "source": "Semantic"
  }
]
```

### `posts/locations.json`

Keyed by **post filename** (e.g. `Polarsteps/India/126_india.md`). Manual and pre-timeline only; no new “generated” entries after integration.

**Per-entry fields (placeholders = `null` when not from Google):**

| Field       | Type   | Description |
|------------|--------|-------------|
| `lat`      | number | Required |
| `lng`      | number | Required |
| `country`  | string \| null | |
| `place`    | string \| null | |
| `source`   | string | `"manual"`, `"polarsteps"`, or legacy `"generated"` |
| `accuracy` | number \| null | Placeholder if missing |
| `placeId`  | string \| null | Placeholder if missing |
| `address`  | string \| null | Placeholder if missing |
| `name`     | string \| null | Placeholder if missing |
| `timestamp`| string \| null | ISO 8601 or null |

## Data flow

1. **Takeout** (manual): User exports Location History from Google Takeout. Either:
   - **Records.json** – raw points: `locations[]` with `timestamp`/`timestampMs`, `latitudeE7`, `longitudeE7`, `accuracy`, `velocity`, `heading`, `source`, etc.
   - **Semantic** – monthly files (e.g. `2021_JANUARY.json`) with `timelineObjects[]`: `activitySegment` (start/end + `simplifiedRawPath.points`) and `placeVisit` (centerLatE7, centerLngE7, duration).
2. **Input in repo**: Takeout placed under a fixed path, e.g. `data/takeout/`:
   - `data/takeout/Records.json` and/or
   - `data/takeout/Semantic Location History/**/*.json`
3. **Conversion script** (e.g. `scripts/takeout_to_timeline.py`):
   - Reads all Takeout JSON (Records + Semantic).
   - Extracts points: Records → one point per location; Semantic → activitySegment start/end + simplifiedRawPath points, placeVisit center + start timestamp.
   - Normalizes to timeline.json shape (lat/lng from E7 ÷ 10^7, date = timestamp date, keep optional fields).
   - **Rsync-like merge** into existing `posts/timeline.json`: for each new point, use a stable id (e.g. `date + timestamp + lat + lng` rounded) to decide add/update; only write if different; do not remove entries that still appear in Takeout (so re-processing full Takeout is safe).
4. **GitHub Action** (daily):
   - Checkout repo.
   - Run conversion script (input = `data/takeout/`, output = `posts/timeline.json`).
   - If `timeline.json` changed, commit and push.

## UI (V1)

- Load `posts/timeline.json` and `posts/index.json`.
- For each timeline point, take `date`; find a travel post whose `date` (date part) equals that `date`; if found, render the point and link popup to that post (same popup pattern as existing markers: title, date, “Read post →”).
- If multiple posts on the same day, use one (e.g. first by filename or order in index).
- Timeline points: visually distinct (e.g. smaller or dimmer marker) so they don’t overwhelm post markers. Include in map bounds.
- No route line through raw timeline points for V1; route stays based on post markers + locations/timeline-by-date as currently.

## Future

- Process points in the action (e.g. dedupe, sample, or simplify) to reduce noise and control route flow; for V1 use raw timeline data as-is.

---

## Detailed build prompt (for implementation)

Use the following as a single prompt to implement the feature.

---

**Context:** Static site with a travel map (Leaflet). Posts in `posts/index.json`; locations in `posts/locations.json` (keyed by post filename). We want Google Timeline data in `posts/timeline.json`, filled by a daily GitHub Action that reads Google Takeout JSON and merges into `timeline.json` with rsync-like logic.

**Requirements:**

1. **`posts/timeline.json`**
   - Array of point objects. Each: `lat`, `lng`, `date` (YYYY-MM-DD), `timestamp` (ISO). Optional: `accuracy`, `placeId`, `address`, `name`, `activityType`, `source` (`"Records"` or `"Semantic"`).
   - Coords from Takeout: latitudeE7/longitudeE7 (or latE7/lngE7) → divide by 10^7. Date from timestamp.

2. **Takeout input**
   - **Records.json**: `locations[]` – each item has `timestamp` (or `timestampMs`), `latitudeE7`, `longitudeE7`, optional `accuracy`, `velocity`, `heading`, `source`.
   - **Semantic**: JSON files with `timelineObjects[]`. Each object has either:
     - `activitySegment`: `startLocation`, `endLocation` (latitudeE7, longitudeE7), `duration.startTimestamp`/`endTimestamp`, optional `simplifiedRawPath.points[]` (latE7, lngE7, timestamp).
     - `placeVisit`: `centerLatE7`, `centerLngE7`, `duration.startTimestamp`.
   - Support both; extract all points (Records 1:1; Semantic: start, end, and each simplifiedRawPath point, plus place visit center with start time).

3. **Conversion script** (e.g. `scripts/takeout_to_timeline.py`)
   - Args or env: input dir (default `data/takeout/`), output file (default `posts/timeline.json`).
   - Discovers Records.json and any `**/*.json` under Semantic Location History.
   - Normalizes to the timeline point schema; builds list of new points.
   - **Rsync-like merge**: load existing `posts/timeline.json` if present. For each new point, identity = (date, timestamp, round(lat,5), round(lng,5)). If identity already exists and content equal, skip. If new or changed, add/update. Do not delete points from output that are no longer in Takeout (so full re-run is additive/update-only).
   - Write `posts/timeline.json` (array, indent 2).

4. **GitHub Action**
   - Name: e.g. “Update timeline from Takeout”.
   - Trigger: daily (cron), plus `workflow_dispatch`.
   - Steps: checkout, run conversion script (input from repo at e.g. `data/takeout/`), if `posts/timeline.json` changed then commit and push.
   - If Takeout is not in repo (e.g. user uploads elsewhere), document that user must place Takeout at `data/takeout/` or set input path via env; script reads from that path.

5. **Travel map UI** (`js/travel.js`)
   - Fetch `posts/timeline.json` along with index and locations.
   - Build a map: date → travel post (from index, category Travel, date part YYYY-MM-DD).
   - For each timeline point: resolve `post` = post for `point.date`; if post exists, add a marker (smaller/different style) at (lat, lng) with popup linking to that post (same link as existing markers). Add timeline markers to the same cluster group or a separate layer; include in fitBounds.

6. **locations.json**
   - From now on, treat as manual-only (no new “generated” entries). Existing entries: add optional placeholder fields `accuracy`, `placeId`, `address`, `name`, `timestamp` (null when unknown). Update `scripts/generate_locations.py` to write these placeholders for any new manual/generated entries and to not overwrite non-generated sources; document that Timeline data lives in `timeline.json` and is matched by date in the UI.

7. **Docs**
   - Keep `docs/GOOGLE_TIMELINE_INTEGRATION.md` in sync with paths and schema above.

**Out of scope for V1:** Deduplication/simplification of timeline points in the action; route line through timeline points only. Raw timeline data is enough for V1.

---
