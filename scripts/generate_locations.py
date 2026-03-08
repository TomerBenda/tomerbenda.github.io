"""
Generate posts/locations.json from posts/index.json using the same place→coords
logic as js/travel-data.js. locations.json is for manual / pre-timeline data only;
Google Timeline data lives in posts/timeline.json (see scripts/takeout_to_timeline.py).

Run from repo root: python scripts/generate_locations.py

Place→coords source: data/travel_places.json (keep in sync when adding new places).
"""

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
INDEX_FILE = REPO_ROOT / "posts" / "index.json"
PLACES_FILE = REPO_ROOT / "data" / "travel_places.json"
OUT_FILE = REPO_ROOT / "posts" / "locations.json"


def get_location_from_filename(filename: str) -> tuple[str, str]:
    """Mirror js getLocationFromFilename: return (country, place_slug)."""
    s = filename.replace(".md", "").rstrip("/")
    parts = s.split("/")
    country = parts[-2].strip() if len(parts) >= 2 else ""
    last = parts[-1] if parts else ""
    under = last.find("_")
    place = (last[under + 1:] if under >= 0 else last).lower().replace(" ", "_")
    return country, place


def get_coordinates(place_slug: str, country: str, places: dict) -> list[float] | None:
    """Mirror js getCoordinatesForPlace using places dict (key → [lat, lng])."""
    key = place_slug.replace("_", " ")
    if place_slug in places:
        return places[place_slug]
    if key in places:
        return places[key]
    if place_slug.startswith("to_"):
        stripped = place_slug[3:]
        if stripped in places:
            return places[stripped]
        if stripped.replace("_", " ") in places:
            return places[stripped.replace("_", " ")]
    ckey = (country or "").lower().strip()
    if ckey in places:
        return places[ckey]
    return None


def main():
    with INDEX_FILE.open("r", encoding="utf-8") as f:
        posts = json.load(f)
    with PLACES_FILE.open("r", encoding="utf-8") as f:
        places = json.load(f)

    # Start from existing locations so Polarsteps/Google Timeline imports are not overwritten
    locations = {}
    if OUT_FILE.exists():
        try:
            with OUT_FILE.open("r", encoding="utf-8") as f:
                locations = json.load(f)
        except Exception:
            pass

    for p in posts:
        cats = p.get("categories") or (p.get("category") and [p["category"]]) or []
        if not any((c or "").lower() == "travel" for c in cats):
            continue
        filename = p.get("filename") or ""
        if not filename:
            continue
        # Only overwrite if missing or previously generated (keep polarsteps/google_timeline)
        existing = locations.get(filename)
        if existing and existing.get("source") not in (None, "generated"):
            continue
        country, place_slug = get_location_from_filename(filename)
        coords = get_coordinates(place_slug, country, places)
        if coords and len(coords) >= 2:
            locations[filename] = {
                "lat": float(coords[0]),
                "lng": float(coords[1]),
                "country": country or None,
                "place": place_slug or None,
                "source": "generated",
                "accuracy": None,
                "placeId": None,
                "address": None,
                "name": None,
                "timestamp": None,
            }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(locations, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(locations)} entries to {OUT_FILE}")


if __name__ == "__main__":
    main()
