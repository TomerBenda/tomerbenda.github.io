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
            posts.append(
                {
                    "filename": relative_path,
                    "title": title,
                    "date": date,
                    "categories": categories,
                }
            )
        else:
            print(f"\t[*] Skipped: {relative_path}")

    build_index(posts)


if __name__ == "__main__":
    main()

