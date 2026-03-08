"""
Geocode travel post locations using Nominatim (OpenStreetMap).

Reads posts/index.json, extracts place names from travel post filenames,
queries Nominatim, and writes results to posts/geocoded.json.

Incremental: only geocodes posts not already in the cache.
Failed lookups (null) are retried on the next run in case the script improves.
Intentional skips (no geographic query possible) are marked {skip: true}.

Respects Nominatim's 1 request/second rate limit.

Run from repo root:
  python scripts/geocode_travel_posts.py
"""

import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT     = Path(__file__).resolve().parent.parent
INDEX_FILE    = REPO_ROOT / "posts" / "index.json"
TIMELINE_FILE = REPO_ROOT / "posts" / "timeline.json"
OUT_FILE      = REPO_ROOT / "posts" / "geocoded.json"

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT    = "tbd.codes-travel-geocoder/1.0 (https://tbd.codes)"
RATE_LIMIT    = 1.1   # seconds between requests (Nominatim ToS: max 1/sec)

# ISO 3166-1 alpha-2 codes — used to restrict results to the right country
COUNTRY_CODES = {
    "Vietnam": "vn", "Thailand": "th", "Singapore": "sg",
    "Sri Lanka": "lk", "India": "in", "Hong Kong": "hk",
    "Japan": "jp", "Cambodia": "kh", "Malaysia": "my",
    "Indonesia": "id", "Philippines": "ph", "Myanmar": "mm",
    "Laos": "la", "Nepal": "np",
}

# Path segments that are not real geographic locations
NON_GEOGRAPHIC = {"polarsteps"}


def extract_query(filename):
    """
    Derive a Nominatim search query from a post filename.
    Returns (query_string, country_code) or (None, None) if no location can be derived.

    Examples:
      "Polarsteps/Vietnam/Hanoi 1.md"             -> ("Hanoi, Vietnam", "vn")
      "Polarsteps/Japan/153_fukuoka.md"            -> ("fukuoka, Japan", "jp")
      "Polarsteps/Thailand/55_to_pai.md"           -> ("pai, Thailand", "th")
      "Polarsteps/Japan/154_takeo_and_nagasaki.md" -> ("Japan", "jp")
      "Polarsteps/gym_map.md"                      -> (None, None)
    """
    parts = filename.replace(".md", "").split("/")
    if len(parts) < 2:
        return None, None

    country = parts[-2].strip()
    if country.lower() in NON_GEOGRAPHIC:
        return None, None

    country_code = COUNTRY_CODES.get(country)
    last = parts[-1]

    # Remove numeric prefix: "153_fukuoka" -> "fukuoka"
    if re.match(r"^\d+_", last):
        slug = last[last.index("_") + 1:]
    else:
        slug = last

    # Underscores/hyphens to spaces, trailing digits removed ("Hanoi 1" -> "Hanoi")
    place = slug.replace("_", " ").replace("-", " ").strip()
    place = re.sub(r"\s*\d+$", "", place).strip()

    # Strip leading directional prefix ("to pai" -> "pai", "to chiang mai" -> "chiang mai")
    place = re.sub(r"^to\s+", "", place, flags=re.IGNORECASE).strip()

    if not place:
        return country, country_code

    # Compound or ambiguous names -> use country only for accuracy
    if " and " in place.lower() or len(place.split()) > 3:
        return country, country_code

    # Place same as country (e.g., "Hong Kong / hong_kong") -> just country, no code filter
    if place.lower() == country.lower():
        return country, None

    return f"{place}, {country}", country_code


def nominatim_geocode(query, country_code=None):
    """Return (lat, lng) for query restricted to country_code, or None if not found."""
    params = {"q": query, "format": "json", "limit": 1, "addressdetails": 0}
    if country_code:
        params["countrycodes"] = country_code
    url = f"{NOMINATIM_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        if data:
            return round(float(data[0]["lat"]), 6), round(float(data[0]["lon"]), 6)
    except Exception as e:
        print(f"  Nominatim error for {query!r}: {e}")
    return None


def main():
    if not INDEX_FILE.exists():
        print(f"Index not found: {INDEX_FILE}")
        return

    with INDEX_FILE.open(encoding="utf-8") as f:
        posts = json.load(f)

    # Load existing cache
    geocoded = {}
    if OUT_FILE.exists():
        with OUT_FILE.open(encoding="utf-8") as f:
            geocoded = json.load(f)

    # Build set of dates covered by timeline visits — those posts don't need geocoding
    timeline_dates = set()
    if TIMELINE_FILE.exists():
        with TIMELINE_FILE.open(encoding="utf-8") as f:
            tl = json.load(f)
        timeline_dates = {pt["date"] for pt in tl if pt.get("type") == "visit" and pt.get("date")}

    travel = [
        p for p in posts
        if "travel" in [c.lower() for c in (p.get("categories") or [p.get("category", "") or ""])]
    ]

    def post_date(p):
        return (p.get("date") or "").replace("T", " ").split(" ")[0]

    # Geocode posts not in cache, not already covered by timeline, plus previously failed lookups
    to_geocode = [
        p for p in travel
        if (p["filename"] not in geocoded or geocoded[p["filename"]] is None)
        and post_date(p) not in timeline_dates
    ]

    if not to_geocode:
        resolved = sum(1 for v in geocoded.values() if isinstance(v, dict) and "lat" in v)
        print(f"All {len(travel)} travel posts already geocoded ({resolved} resolved). Nothing to do.")
        return

    print(f"Geocoding {len(to_geocode)} posts (cache has {len(geocoded)}, "
          f"timeline covers {len(timeline_dates)} dates)...")
    added = 0
    skipped = 0
    query_cache = {}  # (query, country_code) -> (result, effective_query)

    for i, post in enumerate(to_geocode):
        fn = post["filename"]
        query, country_code = extract_query(fn)

        if not query:
            print(f"  [{i+1}/{len(to_geocode)}] SKIP (no location): {fn}")
            geocoded[fn] = {"skip": True}
            skipped += 1
            continue

        print(f"  [{i+1}/{len(to_geocode)}] {fn!r} -> {query!r}", end=" ... ", flush=True)

        cache_key = (query, country_code)
        if cache_key in query_cache:
            result, effective_query = query_cache[cache_key]
            cached = True
        else:
            result = nominatim_geocode(query, country_code)
            effective_query = query

            # If city-level query failed, retry with country-only fallback
            if not result and ", " in query:
                time.sleep(RATE_LIMIT)
                country_fallback = query.split(", ")[-1]
                result = nominatim_geocode(country_fallback, None)
                if result:
                    effective_query = country_fallback

            query_cache[cache_key] = (result, effective_query)
            time.sleep(RATE_LIMIT)
            cached = False

        if result:
            lat, lng = result
            geocoded[fn] = {"lat": lat, "lng": lng, "query": effective_query}
            print(f"({lat}, {lng})" + (" [cached]" if cached else ""))
            added += 1
        else:
            geocoded[fn] = None   # mark as failed — will retry on next run
            print("not found" + (" [cached]" if cached else ""))
            skipped += 1

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(geocoded, f, indent=2, ensure_ascii=False)

    resolved = sum(1 for v in geocoded.values() if isinstance(v, dict) and "lat" in v)
    print(f"\nDone. Added {added}, skipped/failed {skipped}. "
          f"Resolved: {resolved}/{len(travel)} travel posts.")
    print(f"Output: {OUT_FILE}")


if __name__ == "__main__":
    main()
