import requests, json, os

USERNAME = os.environ.get("DISCOGS_USERNAME", "tbdtbd")
OUTPUT_PATH = "data/discogs.json"

BASE_URL = f"https://api.discogs.com/users/{USERNAME}/collection/folders/0/releases"

def fetch_collection():
    page = 1
    per_page = 100
    all_releases = []

    while True:
        print(f"Fetching page {page}...")
        resp = requests.get(BASE_URL, headers={
            "User-Agent": "MyDiscogsSite/1.0"
        }, params={"page": page, "per_page": per_page})
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

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(all_releases, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(all_releases)} releases to {OUTPUT_PATH}")

if __name__ == "__main__":
    fetch_collection()
