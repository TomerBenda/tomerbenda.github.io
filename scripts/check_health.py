#!/usr/bin/env python3
"""
check_health.py — scan all blog posts and report potential issues:
  - Missing title
  - Missing date
  - Missing categories
  - Missing location (for travel posts)
  - Malformed frontmatter (can't parse YAML)
  - Images referenced but file not found
"""

import json
import os
import re
import sys
from pathlib import Path

import yaml

POSTS_DIR = Path("posts")
LOCATIONS_FILE = POSTS_DIR / "locations.json"


def parse_frontmatter(filepath: Path):
    """Return (fm_dict, body) or (None, raw_text) on parse failure."""
    try:
        text = filepath.read_text(encoding="utf-8")
    except Exception as e:
        return None, str(e)

    if not text.startswith("---"):
        return {}, text

    end = text.find("---", 3)
    if end == -1:
        return None, text

    try:
        fm = yaml.safe_load(text[3:end]) or {}
    except yaml.YAMLError as e:
        return None, text[3:end]

    body = text[end + 3:].strip()
    return fm, body


def get_image_refs(body: str) -> list:
    """Extract image filenames referenced in the post body."""
    refs = []
    # Obsidian embeds: ![[filename.jpg]]
    refs += re.findall(r"!\[\[(.+?)\]\]", body)
    # Standard markdown images: ![alt](path)
    refs += re.findall(r"!\[.*?\]\((.+?)\)", body)
    return refs


def main():
    if not POSTS_DIR.exists():
        print(f"[!] Posts directory '{POSTS_DIR}' not found. Run from repo root.")
        sys.exit(1)

    # Load locations for travel-post checks
    locations = {}
    if LOCATIONS_FILE.exists():
        try:
            locations = json.loads(LOCATIONS_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass

    md_files = sorted(POSTS_DIR.rglob("*.md"))
    if not md_files:
        print("No markdown files found.")
        return

    issues_by_file = {}

    for filepath in md_files:
        rel = filepath.relative_to(POSTS_DIR).as_posix()
        issues = []

        fm, body = parse_frontmatter(filepath)

        if fm is None:
            issues.append("MALFORMED frontmatter (YAML parse error)")
            issues_by_file[rel] = issues
            continue

        # Skip posts not targeted at the blog
        uploadto = fm.get("uploadto", [])
        if isinstance(uploadto, str):
            uploadto = [u.strip().lower() for u in uploadto.split(",")]
        elif isinstance(uploadto, list):
            uploadto = [str(u).strip().lower() for u in uploadto]
        else:
            uploadto = []

        if "blog" not in uploadto:
            continue  # not a blog post; skip

        # --- checks ---
        if not fm.get("title"):
            issues.append("Missing title")

        if not fm.get("date"):
            issues.append("Missing date")

        categories = fm.get("categories", [])
        if isinstance(categories, str):
            categories = [c.strip() for c in categories.split(",")]
        if not categories or categories == [""]:
            issues.append("Missing categories")

        # Travel posts should have a location
        cat_lower = [c.lower() for c in (categories or [])]
        if "travel" in cat_lower:
            if rel not in locations:
                issues.append("Travel post missing location in posts/locations.json")

        # Referenced images should exist
        for img_ref in get_image_refs(body):
            # Strip query strings / anchors
            img_path_str = img_ref.split("?")[0].split("#")[0]
            # Resolve relative to post directory
            if img_path_str.startswith("posts/") or img_path_str.startswith("/"):
                # Absolute-ish path
                candidate = Path(img_path_str.lstrip("/"))
            else:
                post_dir = filepath.parent
                candidate = post_dir / img_path_str
            if not candidate.exists():
                issues.append(f"Image not found: {img_ref}")

        if issues:
            issues_by_file[rel] = issues

    # Report
    if not issues_by_file:
        print("[+] All posts look healthy!")
        return

    print(f"[!] Found issues in {len(issues_by_file)} post(s):\n")
    for rel, issues in sorted(issues_by_file.items()):
        print(f"  {rel}")
        for issue in issues:
            print(f"    - {issue}")
        print()

    sys.exit(1)


if __name__ == "__main__":
    main()
