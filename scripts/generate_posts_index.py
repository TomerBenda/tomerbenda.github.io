from pathlib import Path
from typing import List, Dict, Any

from index_utils import parse_frontmatter, get_markdown_files, write_json_file

POSTS_DIR = Path("posts")
INDEX_FILE = POSTS_DIR / "index.json"


def build_index(posts: List[Dict[str, Any]]) -> None:
    try:
        write_json_file(INDEX_FILE, posts)
        print(f"[+] Wrote index file with {len(posts)} posts to '{INDEX_FILE}'")
    except Exception as e:
        print(f"[!] Failed to write index file: {e}")


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
            if c == '\n' and (i+1 == len(after_marker) or after_marker[i+1] == '\n'):
                return after_marker[:i].strip()
        return after_marker.strip()
    except Exception as e:
        print(f"\t[!] Error extracting song from {filepath}: {e}")
        return None

def main() -> None:
    posts: List[Dict[str, Any]] = []

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
            post_entry = {
                "filename": relative_path,
                "title": title,
                "date": date,
                "categories": categories,
            }
            # Extract song of the day directly from the post
            song_text = extract_song_of_the_day(filepath)
            if song_text:
                post_entry["song_of_the_day"] = song_text
            posts.append(post_entry)
        else:
            print(f"\t[*] Skipped: {relative_path}")

    build_index(posts)


if __name__ == "__main__":
    main()

