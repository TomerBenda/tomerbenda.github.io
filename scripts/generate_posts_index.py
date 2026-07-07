import os
import json
import sys
import yaml
from pathlib import Path
from typing import List, Dict, Any

# Windows consoles default to cp1252; post filenames are Hebrew/UTF-8
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout.reconfigure(encoding="utf-8")

POSTS_DIR = Path("posts")
INDEX_FILE = POSTS_DIR / "index.json"
FRONTMATTER_KEYS = ["title", "date", "categories", "uploadto"]


def parse_frontmatter(filepath: Path) -> Dict[str, Any]:
    print(f"[ ] Parsing frontmatter: {filepath}")
    result = {key: None for key in FRONTMATTER_KEYS}

    try:
        with filepath.open("r", encoding="utf-8") as f:
            lines = f.readlines()

        if lines and lines[0].strip() == "---":
            frontmatter = []
            for line in lines[1:]:
                if line.strip() == "---":
                    break
                frontmatter.append(line)

            fm_data = yaml.safe_load("".join(frontmatter)) or {}

            for key in FRONTMATTER_KEYS:
                value = fm_data.get(key, None)

                if key == "date":
                    result[key] = str(value).strip().replace("T", " ") if value else ""
                elif key == "categories":
                    if isinstance(value, str):
                        result[key] = [item.strip() for item in value.split(",")]
                    elif isinstance(value, list):
                        result[key] = value
                    else:
                        result[key] = []
                elif key == "uploadto":
                    if isinstance(value, str):
                        result[key] = [
                            item.strip().lower() for item in value.split(",")
                        ]
                    elif isinstance(value, list):
                        result[key] = [str(v).strip().lower() for v in value]
                    else:
                        result[key] = []
                else:
                    result[key] = str(value).strip() if value else ""

            return result
        else:
            print(f"\t[!] No frontmatter found in {filepath}")
    except Exception as e:
        print(f"\t[!] Error parsing {filepath}: {e}")

    return result


def extract_song_of_the_day(filepath: Path) -> str | None:
    """Extract the 'שיר היום' section from a post's markdown body."""
    try:
        with filepath.open("r", encoding="utf-8") as f:
            content = f.read()

        # Remove frontmatter if present
        body_content = content
        if content.startswith("---"):
            end = content.find("---", 3)
            if end != -1:
                body_content = content[end + 3:].strip()

        # Look for "שיר היום:" marker
        song_marker = "שיר היום:"
        index = body_content.find(song_marker)
        if index == -1:
            return None
        # Extract text after the marker (up to next blank line or end)
        after_marker = body_content[index + len(song_marker):].lstrip()
        # Stop at first blank line or end of string
        for i, c in enumerate(after_marker):
            if c == "\n" and (i + 1 == len(after_marker) or after_marker[i + 1] == "\n"):
                return after_marker[:i].strip()
        return after_marker.strip()
    except Exception as e:
        print(f"\t[!] Error extracting song from {filepath}: {e}")
        return None


def get_markdown_files(directory: Path) -> List[Path]:
    print(f"[ ] Scanning directory '{directory}' for markdown files")
    md_files = [f for f in directory.rglob("*.md")]
    print(f"[+] Found {len(md_files)} markdown files")
    return sorted(md_files)


def build_index(posts: List[Dict[str, Any]]) -> None:
    try:
        with INDEX_FILE.open("w", encoding="utf-8") as f:
            json.dump(posts, f, indent=2)
        print(f"[+] Wrote index file with {len(posts)} posts to '{INDEX_FILE}'")
    except Exception as e:
        print(f"[!] Failed to write index file: {e}")


posts = []

for filepath in get_markdown_files(POSTS_DIR):
    relative_path = filepath.relative_to(POSTS_DIR).as_posix()
    print(f"[ ] Processing {relative_path}")
    fm = parse_frontmatter(filepath)

    title = (
        fm.get("title") or relative_path.replace(".md", "").replace("-", " ").title()
    )
    date = fm.get("date", "")
    categories = fm.get("categories", [])
    uploadto = fm.get("uploadto", [])

    if uploadto and "blog" in uploadto:
        entry = {
            "filename": relative_path,
            "title": title,
            "date": date,
            "categories": categories,
        }
        song = extract_song_of_the_day(filepath)
        if song:
            entry["song_of_the_day"] = song
        posts.append(entry)
    else:
        print(f"\t[*] Skipped: {relative_path}")

build_index(posts)
