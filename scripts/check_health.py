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

# Windows consoles default to cp1252; post filenames are Hebrew/UTF-8
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout.reconfigure(encoding="utf-8")

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
    """Extract (kind, ref) image refs; kind is 'obsidian' or 'markdown'."""
    refs = []
    # Obsidian embeds: ![[filename.jpg]] or ![[filename.jpg|300]]
    refs += [("obsidian", m) for m in re.findall(r"!\[\[(.+?)\]\]", body)]
    # Standard markdown images: ![alt](path)
    refs += [("markdown", m) for m in re.findall(r"!\[.*?\]\((.+?)\)", body)]
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

    # Errors fail CI (structural problems this repo must not ship);
    # warnings are content gaps that live vault-side — report, don't fail.
    errors_by_file = {}
    warnings_by_file = {}

    for filepath in md_files:
        rel = filepath.relative_to(POSTS_DIR).as_posix()
        errors = []
        warnings = []

        fm, body = parse_frontmatter(filepath)

        if fm is None:
            errors.append("MALFORMED frontmatter (YAML parse error)")
            errors_by_file[rel] = errors
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
            warnings.append("Missing title")

        if not fm.get("date"):
            warnings.append("Missing date")

        categories = fm.get("categories", [])
        if isinstance(categories, str):
            categories = [c.strip() for c in categories.split(",")]
        if not categories or categories == [""]:
            warnings.append("Missing categories")

        # Travel posts should have a location
        cat_lower = [c.lower() for c in (categories or [])]
        if "travel" in cat_lower:
            if rel not in locations:
                warnings.append("Travel post missing location in posts/locations.json")

        # Referenced images should exist (blog.js renders ![[X]] from the
        # post's attachments/ subfolder; markdown paths are site-root relative)
        for kind, img_ref in get_image_refs(body):
            img_path_str = img_ref.split("?")[0].split("#")[0].split("|")[0].strip()
            if img_path_str.startswith(("http://", "https://")):
                continue
            if kind == "obsidian":
                candidate = filepath.parent / "attachments" / img_path_str
            elif img_path_str.startswith("posts/") or img_path_str.startswith("/"):
                candidate = Path(img_path_str.lstrip("/"))
            else:
                candidate = filepath.parent / img_path_str
            if not candidate.exists():
                warnings.append(f"Image not found: {img_ref}")

        if errors:
            errors_by_file[rel] = errors
        if warnings:
            warnings_by_file[rel] = warnings

    # Report
    n_errors = sum(len(v) for v in errors_by_file.values())
    n_warnings = sum(len(v) for v in warnings_by_file.values())

    if not errors_by_file and not warnings_by_file:
        print("[+] All posts look healthy!")
    if errors_by_file:
        print(f"[!] {n_errors} error(s) in {len(errors_by_file)} post(s):\n")
        for rel, issues in sorted(errors_by_file.items()):
            print(f"  {rel}")
            for issue in issues:
                print(f"    - {issue}")
            print()
    if warnings_by_file:
        print(f"[~] {n_warnings} warning(s) in {len(warnings_by_file)} post(s):\n")
        for rel, issues in sorted(warnings_by_file.items()):
            print(f"  {rel}")
            for issue in issues:
                print(f"    - {issue}")
            print()

    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as f:
            f.write("## Post health\n")
            f.write(f"- Errors: {n_errors}\n")
            f.write(f"- Warnings: {n_warnings}\n")
            for rel, issues in sorted(errors_by_file.items()):
                for issue in issues:
                    f.write(f"  - ❌ `{rel}` — {issue}\n")
            for rel, issues in sorted(warnings_by_file.items()):
                for issue in issues:
                    f.write(f"  - ⚠️ `{rel}` — {issue}\n")

    if errors_by_file:
        sys.exit(1)


if __name__ == "__main__":
    main()
