"""Fetch song-of-the-day tracks from monthly Spotify playlists into data/songlog.json.

The song-of-the-day habit lives in public monthly playlists; each item's
added_at date is the log date, so the playlists extend the vault-era log
seamlessly.

Env:
    SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET  app creds (client-credentials
        flow — public playlists need no user authorization)
    SPOTIFY_USER                               profile id owning the playlists
    SONGLOG_PLAYLIST_PATTERN                   regex a playlist name must match
                                               (default: ^\\d{4}-\\d{2}$)

Behavior: missing creds/user -> notice + exit 0 (CI stays green before
setup). API errors -> exit 1. Never overwrites non-empty tracks with empty.
"""
import base64
import json
import os
import re
import sys
from datetime import datetime, timezone

import requests

CID = os.environ.get("SPOTIFY_CLIENT_ID", "")
SECRET = os.environ.get("SPOTIFY_CLIENT_SECRET", "")
USER = os.environ.get("SPOTIFY_USER", "")
PATTERN = os.environ.get("SONGLOG_PLAYLIST_PATTERN", r"^\d{4}-\d{2}$")
OUT = "data/songlog.json"


def main():
    if not (CID and SECRET and USER):
        print("Spotify credentials/user not configured — skipping songlog fetch.")
        return

    tok = requests.post(
        "https://accounts.spotify.com/api/token",
        data={"grant_type": "client_credentials"},
        headers={"Authorization": "Basic " + base64.b64encode(f"{CID}:{SECRET}".encode()).decode()},
    )
    if tok.status_code != 200:
        sys.exit(f"Spotify token error {tok.status_code}: {tok.text[:200]}")
    auth = {"Authorization": f"Bearer {tok.json()['access_token']}"}

    playlists = []
    url = f"https://api.spotify.com/v1/users/{USER}/playlists?limit=50"
    while url:
        r = requests.get(url, headers=auth)
        if r.status_code != 200:
            sys.exit(f"Spotify playlists error {r.status_code}: {r.text[:200]}")
        d = r.json()
        playlists += [p for p in d.get("items", []) if p]
        url = d.get("next")

    rx = re.compile(PATTERN)
    monthly = [p for p in playlists if rx.match(p.get("name", ""))]
    print(f"{len(monthly)} playlists match {PATTERN!r}: {[p['name'] for p in monthly]}")

    tracks = []
    for pl in monthly:
        url = pl["tracks"]["href"] + "?limit=100&fields=items(added_at,track(name,artists(name),external_urls)),next"
        while url:
            r = requests.get(url, headers=auth)
            if r.status_code != 200:
                sys.exit(f"Spotify tracks error {r.status_code}: {r.text[:200]}")
            d = r.json()
            for it in d.get("items", []):
                t = it.get("track") or {}
                if not t.get("name"):
                    continue
                artists = ", ".join(a["name"] for a in t.get("artists", []))
                tracks.append({
                    "date": (it.get("added_at") or "")[:10],
                    "song": f"{t['name']} - {artists}" if artists else t["name"],
                    "url": (t.get("external_urls") or {}).get("spotify"),
                    "month": pl["name"],
                })
            url = d.get("next")
    tracks.sort(key=lambda x: x["date"])

    if not tracks and os.path.exists(OUT):
        try:
            existing = json.load(open(OUT, encoding="utf-8")).get("tracks", [])
        except Exception:
            existing = []
        if existing:
            sys.exit("Refusing to overwrite non-empty songlog with an empty result.")

    os.makedirs("data", exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(
            {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "tracks": tracks},
            f, ensure_ascii=False, indent=1,
        )
    print(f"Saved {len(tracks)} tracks to {OUT}")


if __name__ == "__main__":
    main()
