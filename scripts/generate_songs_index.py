import json
from pathlib import Path
from typing import List, Dict, Any

from index_utils import write_json_file

POSTS_DIR = Path("posts")
SONGS_INDEX_FILE = Path("data") / "songs.json"




def extract_song_of_day(filepath: Path, title: str, date: str) -> Dict[str, Any] | None:
    """Extract the 'שיר היום' section from a post"""
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

        # Extract text after the marker
        song_text = body_content[index + len(song_marker):].strip()

        return {
            "date": date,
            "title": title,
            "songText": song_text,
            "filename": filepath.relative_to(POSTS_DIR).as_posix()
        }
    except Exception as e:
        print(f"\t[!] Error extracting song from {filepath}: {e}")
        return None


# Note: this script reads `posts/index.json` to find Travel posts


def build_songs_index(posts_index_file: Path) -> None:
    """Generate songs index from Travel category posts"""
    print("[*] Generating songs index...")

    # Load posts index
    try:
        with posts_index_file.open("r", encoding="utf-8") as f:
            posts = json.load(f)
    except Exception as e:
        print(f"[!] Failed to read posts index: {e}")
        return

    # Filter Travel category posts
    travel_posts = [
        p for p in posts
        if any(cat.lower() == "travel" for cat in p.get("categories", []))
    ]
    print(f"[+] Found {len(travel_posts)} Travel category posts")

    # Extract songs
    songs = []
    for post in travel_posts:
        filepath = POSTS_DIR / post["filename"]
        if filepath.exists():
            song = extract_song_of_day(filepath, post["title"], post["date"])
            if song:
                songs.append(song)
                print(f"[+] Extracted song from: {post['filename']}")
        else:
            print(f"[!] Post file not found: {filepath}")

    # Sort by date descending (newest first)
    songs.sort(key=lambda x: x["date"], reverse=True)

    # Write songs index using shared helper
    try:
        write_json_file(SONGS_INDEX_FILE, songs)
        print(f"[+] Wrote {len(songs)} songs to '{SONGS_INDEX_FILE}'")
    except Exception as e:
        print(f"[!] Failed to write songs index: {e}")


if __name__ == "__main__":
    posts_index = POSTS_DIR / "index.json"
    if posts_index.exists():
        build_songs_index(posts_index)
    else:
        print(f"[!] Posts index not found at {posts_index}")
