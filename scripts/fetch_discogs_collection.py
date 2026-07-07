"""Fetch the Discogs collection into data/discogs.json.

Auth: the collection is private on Discogs, so either
  - set DISCOGS_TOKEN (personal access token from discogs.com/settings/developers), or
  - make the collection public in Discogs privacy settings (no token needed).

Fails loudly on API errors and refuses to overwrite existing data with an
empty result, so a misconfigured run can never blank the shelf.
"""
import json
import os
import sys

import requests

USERNAME = os.environ.get("DISCOGS_USERNAME", "tbdtbd")
TOKEN = os.environ.get("DISCOGS_TOKEN", "")
OUTPUT_PATH = "data/discogs.json"

BASE_URL = f"https://api.discogs.com/users/{USERNAME}/collection/folders/0/releases"


def fetch_collection():
    headers = {"User-Agent": "tbd.codes vinyl shelf/1.0"}
    if TOKEN:
        headers["Authorization"] = f"Discogs token={TOKEN}"

    page = 1
    per_page = 100
    all_releases = []

    while True:
        print(f"Fetching page {page}...")
        resp = requests.get(BASE_URL, headers=headers, params={"page": page, "per_page": per_page})
        if resp.status_code != 200:
            msg = resp.json().get("message", resp.text[:200])
            sys.exit(f"Discogs API error {resp.status_code}: {msg}\n"
                     "Hint: set DISCOGS_TOKEN or make the collection public.")
        data = resp.json()

        releases = data.get("releases", [])
        if not releases:
            break

        for r in releases:
            info = r.get("basic_information", {})
            all_releases.append({
                "id": info.get("id"),
                "title": info.get("title"),
                "artist": ", ".join(a["name"] for a in info.get("artists", [])),
                "year": info.get("year"),
                "genres": info.get("genres", []),
                "styles": info.get("styles", []),
                "formats": [f["name"] for f in info.get("formats", [])],
                "cover": info.get("cover_image"),
            })

        if data.get("pagination", {}).get("pages", 0) <= page:
            break
        page += 1

    if not all_releases and os.path.exists(OUTPUT_PATH):
        try:
            existing = json.load(open(OUTPUT_PATH, encoding="utf-8"))
        except Exception:
            existing = []
        if existing:
            sys.exit("Refusing to overwrite non-empty data/discogs.json with an empty collection.")

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(all_releases, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(all_releases)} releases to {OUTPUT_PATH}")


if __name__ == "__main__":
    fetch_collection()
