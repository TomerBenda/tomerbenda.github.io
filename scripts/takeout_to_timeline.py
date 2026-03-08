"""
Convert Google Maps Timeline export to posts/timeline.json.

Input:  data/Timeline.json  (semanticSegments format, exported from
        Google Maps app -> Your Timeline -> Export)
Output: posts/timeline.json — array of { lat, lng, date, timestamp, type }

Point types:
  "visit" — level-0 place visits (primary location data, used to resolve
             post coordinates on the travel map)
  "track" — one representative point per movement segment (shows path detail
             on the map without overwhelming it)

Run from repo root:
  python scripts/takeout_to_timeline.py
"""

import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
INPUT_FILE = REPO_ROOT / "data" / "Timeline.json"
OUT_FILE = REPO_ROOT / "posts" / "timeline.json"


def parse_latlng(s):
    """Parse "5.9731882°, 80.4337779°" -> (lat, lng) or (None, None)."""
    if not s:
        return None, None
    m = re.match(r"([+-]?\d+\.?\d*)°,\s*([+-]?\d+\.?\d*)°", s.strip())
    if not m:
        return None, None
    return round(float(m.group(1)), 6), round(float(m.group(2)), 6)


def iso_date(ts):
    """Extract YYYY-MM-DD from any ISO timestamp string."""
    if not ts:
        return None
    m = re.match(r"(\d{4}-\d{2}-\d{2})", ts)
    return m.group(1) if m else None


def process(data):
    points = []

    for seg in data.get("semanticSegments", []):

        if "visit" in seg:
            visit = seg["visit"]
            # Skip sub-visits (hierarchyLevel > 0); only top-level places
            if visit.get("hierarchyLevel", 0) != 0:
                continue
            candidate = visit.get("topCandidate") or {}
            latlng_str = (candidate.get("placeLocation") or {}).get("latLng", "")
            lat, lng = parse_latlng(latlng_str)
            if lat is None:
                continue
            timestamp = seg.get("startTime", "")
            date = iso_date(timestamp)
            if not date:
                continue
            points.append({
                "lat": lat,
                "lng": lng,
                "date": date,
                "timestamp": timestamp,
                "type": "visit",
            })

        elif "timelinePath" in seg:
            path = seg["timelinePath"]
            if not path:
                continue
            # One representative point per movement segment (middle of the path)
            mid = path[len(path) // 2]
            lat, lng = parse_latlng(mid.get("point", ""))
            if lat is None:
                continue
            timestamp = mid.get("time") or seg.get("startTime", "")
            date = iso_date(timestamp)
            if not date:
                continue
            points.append({
                "lat": lat,
                "lng": lng,
                "date": date,
                "timestamp": timestamp,
                "type": "track",
            })

        # "activity" segments have no location data — skip

    points.sort(key=lambda p: p.get("timestamp", ""))
    return points


def main():
    if not INPUT_FILE.exists():
        print(f"Input not found: {INPUT_FILE}")
        return

    with INPUT_FILE.open("r", encoding="utf-8") as f:
        data = json.load(f)

    points = process(data)

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(points, f, indent=2, ensure_ascii=False)

    visits = sum(1 for p in points if p["type"] == "visit")
    tracks = sum(1 for p in points if p["type"] == "track")
    dates = sorted({p["date"] for p in points})
    date_range = f"{dates[0]} to {dates[-1]}" if dates else "none"
    print(f"Wrote {len(points)} points ({visits} visits, {tracks} track) "
          f"covering {date_range}")
    print(f"Output: {OUT_FILE}")


if __name__ == "__main__":
    main()
