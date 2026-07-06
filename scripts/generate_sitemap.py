"""
Generate sitemap.xml from posts/index.json plus the static pages.

Run from repo root: python scripts/generate_sitemap.py
Wired into .github/workflows/sync-posts.yaml so the sitemap tracks the vault sync.
"""

import json
import re
import sys
from pathlib import Path
from urllib.parse import quote

REPO_ROOT = Path(__file__).resolve().parent.parent
INDEX_FILE = REPO_ROOT / "posts" / "index.json"
OUTPUT_FILE = REPO_ROOT / "sitemap.xml"
SITE_URL = "https://tbd.codes"

STATIC_PAGES = ["", "blog", "travel", "projects", "stats"]


def escape_xml(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def post_entry(post: dict) -> str:
    url = f"{SITE_URL}/blog?post={quote(post['filename'], safe='')}"
    date = (post.get("date") or "").strip().split(" ")[0].split("T")[0]
    lastmod = ""
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        lastmod = f"\n    <lastmod>{date}</lastmod>"
    return f"  <url>\n    <loc>{escape_xml(url)}</loc>{lastmod}\n  </url>"


def main():
    if not INDEX_FILE.exists():
        print(f"[!] Index file not found: {INDEX_FILE}")
        sys.exit(1)

    posts = json.loads(INDEX_FILE.read_text(encoding="utf-8"))

    entries = [
        f"  <url>\n    <loc>{SITE_URL}/{page}</loc>\n  </url>" for page in STATIC_PAGES
    ]
    entries += [post_entry(p) for p in posts]

    sitemap = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )

    OUTPUT_FILE.write_text(sitemap, encoding="utf-8")
    print(f"[+] Written sitemap to {OUTPUT_FILE} ({len(entries)} URLs)")


if __name__ == "__main__":
    main()
