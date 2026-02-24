"""
Convert Google Takeout Location History JSON into posts/timeline.json.

Reads from data/takeout/ (or TAKEOUT_INPUT_DIR):
  - Records.json (raw locations[])
  - Semantic Location History/**/*.json (timelineObjects[]: activitySegment, placeVisit)

Output: posts/timeline.json — array of { lat, lng, date, timestamp, ... }.
Merge is rsync-like: add/update from Takeout, never remove existing entries
by identity (date, timestamp, rounded lat/lng).

Run from repo root: python scripts/takeout_to_timeline.py
"""

import json
import os
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = REPO_ROOT / "data" / "takeout"
OUT_FILE = REPO_ROOT / "posts" / "timeline.json"
# Identity precision for rsync-like merge
ROUND = 5


def e7_to_deg(e7: int) -> float:
    return round(e7 / 1e7, ROUND) if e7 is not None else None


def parse_ts(ts: str | None) -> str | None:
    if not ts:
        return None
    if re.match(r"^\d{4}-\d{2}-\d{2}", ts):
        return ts
    return None


def date_from_ts(ts: str | None) -> str | None:
    if not ts:
        return None
    m = re.match(r"^(\d{4}-\d{2}-\d{2})", ts)
    return m.group(1) if m else None


def point_identity(p: dict) -> tuple:
    """Stable id for rsync: (date, timestamp, lat, lng) with rounded coords."""
    return (
        p.get("date") or "",
        p.get("timestamp") or "",
        round(p["lat"], ROUND) if p.get("lat") is not None else None,
        round(p["lng"], ROUND) if p.get("lng") is not None else None,
    )


def normalize_point(lat: float, lng: float, timestamp: str, **extra) -> dict:
    date = date_from_ts(timestamp)
    out = {
        "lat": lat,
        "lng": lng,
        "date": date,
        "timestamp": timestamp,
    }
    for k, v in extra.items():
        if v is not None:
            out[k] = v
    return out


def extract_records(data: dict) -> list[dict]:
    out = []
    for loc in data.get("locations") or []:
        lat_e7 = loc.get("latitudeE7")
        lng_e7 = loc.get("longitudeE7")
        if lat_e7 is None or lng_e7 is None:
            continue
        ts = loc.get("timestamp")
        if not ts and loc.get("timestampMs") is not None:
            try:
                from datetime import datetime
                ts = datetime.utcfromtimestamp(int(loc["timestampMs"]) / 1000).strftime("%Y-%m-%dT%H:%M:%S.000Z")
            except Exception:
                continue
        if not ts or not re.match(r"^\d{4}-\d{2}", str(ts)):
            continue
        if isinstance(ts, str) and "T" not in ts and re.match(r"^\d+$", ts):
            try:
                from datetime import datetime
                ts = datetime.utcfromtimestamp(int(ts) / 1000).strftime("%Y-%m-%dT%H:%M:%S.000Z")
            except Exception:
                continue
        out.append(
            normalize_point(
                e7_to_deg(lat_e7),
                e7_to_deg(lng_e7),
                ts,
                accuracy=loc.get("accuracy"),
                placeId=loc.get("placeId"),
                velocity=loc.get("velocity"),
                heading=loc.get("heading"),
                source="Records",
            )
        )
    return out


def extract_semantic(data: dict) -> list[dict]:
    out = []
    for obj in data.get("timelineObjects") or []:
        if "activitySegment" in obj:
            seg = obj["activitySegment"]
            start = seg.get("startLocation") or {}
            end = seg.get("endLocation") or {}
            duration = seg.get("duration") or {}
            start_ts = (duration.get("startTimestamp") or "").replace("Z", ".000Z")
            end_ts = (duration.get("endTimestamp") or "").replace("Z", ".000Z")
            activity_type = seg.get("activityType")

            def loc_to_point(loc: dict, ts: str):
                lat_e7 = loc.get("latitudeE7")
                lng_e7 = loc.get("longitudeE7")
                if lat_e7 is None or lng_e7 is None:
                    return None
                return normalize_point(
                    e7_to_deg(lat_e7),
                    e7_to_deg(lng_e7),
                    ts,
                    name=loc.get("name"),
                    address=loc.get("address"),
                    placeId=loc.get("placeId"),
                    activityType=activity_type,
                    source="Semantic",
                )

            if start_ts and start:
                p = loc_to_point(start, start_ts)
                if p:
                    out.append(p)
            if end_ts and end and (start != end or start_ts != end_ts):
                p = loc_to_point(end, end_ts)
                if p:
                    out.append(p)
            path = seg.get("simplifiedRawPath") or {}
            for pt in path.get("points") or []:
                ts = (pt.get("timestamp") or "").replace("Z", ".000Z")
                if not ts:
                    continue
                lat_e7 = pt.get("latE7")
                lng_e7 = pt.get("lngE7")
                if lat_e7 is None or lng_e7 is None:
                    continue
                out.append(
                    normalize_point(
                        e7_to_deg(lat_e7),
                        e7_to_deg(lng_e7),
                        ts,
                        accuracy=pt.get("accuracyMeters"),
                        activityType=activity_type,
                        source="Semantic",
                    )
                )
        elif "placeVisit" in obj:
            visit = obj["placeVisit"]
            lat_e7 = visit.get("centerLatE7") or (visit.get("location") or {}).get("latitudeE7")
            lng_e7 = visit.get("centerLngE7") or (visit.get("location") or {}).get("longitudeE7")
            if lat_e7 is None or lng_e7 is None:
                loc = visit.get("location") or {}
                lat_e7 = loc.get("latitudeE7")
                lng_e7 = loc.get("longitudeE7")
            if lat_e7 is None or lng_e7 is None:
                continue
            duration = visit.get("duration") or {}
            start_ts = (duration.get("startTimestamp") or "").replace("Z", ".000Z")
            if not start_ts:
                continue
            loc = visit.get("location") or {}
            out.append(
                normalize_point(
                    e7_to_deg(lat_e7),
                    e7_to_deg(lng_e7),
                    start_ts,
                    name=loc.get("name") or visit.get("name"),
                    address=loc.get("address"),
                    placeId=loc.get("placeId"),
                    source="Semantic",
                )
            )
    return out


def collect_takeout_files(input_dir: Path) -> list[Path]:
    files = []
    if not input_dir.exists():
        return files
    records = input_dir / "Records.json"
    if records.is_file():
        files.append(records)
    semantic = input_dir / "Semantic Location History"
    if semantic.is_dir():
        files.extend(semantic.rglob("*.json"))
    return sorted(files)


def main():
    input_dir = Path(os.environ.get("TAKEOUT_INPUT_DIR", DEFAULT_INPUT))
    all_points = []
    for path in collect_takeout_files(input_dir):
        try:
            with path.open("r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"Skip {path}: {e}")
            continue
        if "locations" in data:
            all_points.extend(extract_records(data))
        elif "timelineObjects" in data:
            all_points.extend(extract_semantic(data))

    # Rsync-like merge into existing timeline.json
    existing = {}
    if OUT_FILE.exists():
        try:
            with OUT_FILE.open("r", encoding="utf-8") as f:
                arr = json.load(f)
                for p in arr:
                    if isinstance(p, dict) and p.get("lat") is not None and p.get("lng") is not None:
                        existing[point_identity(p)] = p
        except Exception:
            pass

    for p in all_points:
        if p.get("lat") is None or p.get("lng") is None or not p.get("timestamp"):
            continue
        key = point_identity(p)
        existing[key] = p

    out_list = sorted(existing.values(), key=lambda x: (x.get("date") or "", x.get("timestamp") or ""))
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(out_list, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(out_list)} timeline points to {OUT_FILE}")


if __name__ == "__main__":
    main()
