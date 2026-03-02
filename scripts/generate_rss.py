import json
import re
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from urllib.parse import quote

POSTS_DIR = Path("posts")
INDEX_FILE = POSTS_DIR / "index.json"
OUTPUT_FILE = Path("feed.xml")
SITE_URL = "https://tbd.codes"
FEED_TITLE = "tbd"
FEED_DESCRIPTION = "Tomer Ben David's personal blog — travel, tech, and everything in between."
MAX_ITEMS = 50


def parse_post_preview(filepath: Path) -> str:
    """Extract the first non-empty paragraph from a markdown file (after frontmatter)."""
    try:
        with filepath.open("r", encoding="utf-8") as f:
            content = f.read()

        # Strip frontmatter
        if content.startswith("---"):
            end = content.find("---", 3)
            if end != -1:
                content = content[end + 3:].strip()

        # Remove markdown headings, images, and links; get first real paragraph
        paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
        for para in paragraphs:
            # Skip lines that are purely headings, images, or horizontal rules
            clean = re.sub(r"^#{1,6}\s+", "", para)
            clean = re.sub(r"!\[\[.*?\]\]", "", clean)  # Obsidian images
            clean = re.sub(r"!\[.*?\]\(.*?\)", "", clean)  # Markdown images
            clean = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", clean)  # Links → text
            clean = re.sub(r"[*_`~]+", "", clean)  # Bold/italic/code
            clean = clean.strip()
            if clean and not clean.startswith("---"):
                return clean[:300] + ("..." if len(clean) > 300 else "")
    except Exception:
        pass
    return ""


def parse_date(date_str: str) -> datetime:
    """Parse a post date string into a UTC datetime."""
    formats = [
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return datetime.now(timezone.utc)


def escape_xml(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def post_url(filename: str) -> str:
    return f"{SITE_URL}/blog.html?post={quote(filename, safe='')}"


def build_rss(posts: list) -> str:
    now_rfc822 = format_datetime(datetime.now(timezone.utc))

    items = []
    for post in posts[:MAX_ITEMS]:
        filename = post["filename"]
        title = escape_xml(post.get("title") or filename)
        date_str = post.get("date", "")
        dt = parse_date(date_str)
        pub_date = format_datetime(dt)
        url = post_url(filename)
        guid = url

        # Try to get a description from the post file
        post_path = POSTS_DIR / filename
        description = escape_xml(parse_post_preview(post_path)) if post_path.exists() else ""

        categories = post.get("categories") or []
        category_tags = "\n      ".join(
            f"<category>{escape_xml(c)}</category>" for c in categories
        )

        items.append(f"""  <item>
    <title>{title}</title>
    <link>{url}</link>
    <guid isPermaLink="true">{guid}</guid>
    <pubDate>{pub_date}</pubDate>
    <description>{description}</description>
    {category_tags}
  </item>""")

    items_xml = "\n".join(items)

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{FEED_TITLE}</title>
    <link>{SITE_URL}</link>
    <description>{FEED_DESCRIPTION}</description>
    <language>en</language>
    <lastBuildDate>{now_rfc822}</lastBuildDate>
    <atom:link href="{SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
{items_xml}
  </channel>
</rss>
"""


def main():
    if not INDEX_FILE.exists():
        print(f"[!] Index file not found: {INDEX_FILE}")
        return

    with INDEX_FILE.open("r", encoding="utf-8") as f:
        posts = json.load(f)

    print(f"[+] Loaded {len(posts)} posts from index")

    # Sort by date descending (newest first)
    posts.sort(key=lambda p: p.get("date") or "", reverse=True)

    rss_content = build_rss(posts)

    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        f.write(rss_content)

    print(f"[+] Written RSS feed to {OUTPUT_FILE} ({len(posts[:MAX_ITEMS])} items)")


if __name__ == "__main__":
    main()
