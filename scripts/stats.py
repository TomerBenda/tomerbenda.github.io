#!/usr/bin/env python3
"""
stats.py — quick sanity check for the blog.

Prints:
  - Total published posts (+ draft count)
  - Posts per category
  - Posts per month (last 12 months)
  - Travel posts with / without a location entry
"""

import json
from collections import defaultdict
from pathlib import Path

import yaml

POSTS_DIR = Path("posts")
LOCATIONS_FILE = POSTS_DIR / "locations.json"


def parse_frontmatter(filepath: Path):
    try:
        text = filepath.read_text(encoding="utf-8")
    except Exception:
        return {}
    if not text.startswith("---"):
        return {}
    end = text.find("---", 3)
    if end == -1:
        return {}
    try:
        return yaml.safe_load(text[3:end]) or {}
    except yaml.YAMLError:
        return {}


def normalize_list(value):
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    if isinstance(value, list):
        return [str(v).strip() for v in value if v]
    return []


def main():
    if not POSTS_DIR.exists():
        print("[!] Run from repo root.")
        return

    locations = {}
    if LOCATIONS_FILE.exists():
        try:
            locations = json.loads(LOCATIONS_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass

    published = []

    for filepath in sorted(POSTS_DIR.rglob("*.md")):
        fm = parse_frontmatter(filepath)
        uploadto = normalize_list(fm.get("uploadto", []))
        if "blog" not in [u.lower() for u in uploadto]:
            continue
        rel = filepath.relative_to(POSTS_DIR).as_posix()
        categories = normalize_list(fm.get("categories", []))
        date = str(fm.get("date", "") or "")
        published.append({"rel": rel, "categories": categories, "date": date})

    total = len(published)
    print(f"Total published posts : {total}")
    print()

    # Posts per category
    cat_counts = defaultdict(int)
    for p in published:
        for cat in p["categories"]:
            cat_counts[cat.lower()] += 1
        if not p["categories"]:
            cat_counts["(uncategorized)"] += 1

    print("Posts per category:")
    for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
        print(f"  {cat:<25} {count}")
    print()

    # Posts per month (all time, most recent first)
    month_counts = defaultdict(int)
    for p in published:
        month = p["date"][:7] if p["date"] else "(no date)"
        month_counts[month] += 1

    print("Posts per month:")
    for month, count in sorted(month_counts.items(), reverse=True):
        bar = "█" * count
        print(f"  {month}  {bar} {count}")
    print()

    # Travel posts: location coverage
    travel_posts = [p for p in published if "travel" in [c.lower() for c in p["categories"]]]
    if travel_posts:
        with_loc = [p for p in travel_posts if p["rel"] in locations]
        without_loc = [p for p in travel_posts if p["rel"] not in locations]
        print(f"Travel posts: {len(travel_posts)} total")
        print(f"  With location  : {len(with_loc)}")
        print(f"  Without location: {len(without_loc)}")
        if without_loc:
            print("  Missing locations:")
            for p in without_loc:
                print(f"    {p['rel']}")
        print()


if __name__ == "__main__":
    main()
