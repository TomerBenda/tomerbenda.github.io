"""One-time helper: obtain a Spotify refresh token for the now-playing worker.

Usage:
    python scripts/spotify_get_refresh_token.py --client-id XXX --client-secret YYY

Prerequisite: a Spotify app (developer.spotify.com/dashboard) with redirect URI
http://127.0.0.1:8888/callback added in its settings.

Opens the browser for consent, catches the callback on a local HTTP server,
exchanges the code, and prints the refresh token to paste into
`wrangler secret put SPOTIFY_REFRESH_TOKEN`.
"""
import argparse
import base64
import json
import sys
import threading
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer

REDIRECT_URI = "http://127.0.0.1:8888/callback"
SCOPES = "user-read-currently-playing user-read-recently-played"

code_holder = {}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        if "code" in params:
            code_holder["code"] = params["code"][0]
            body = b"<h1>Done. You can close this tab.</h1>"
        else:
            body = b"<h1>No code in callback.</h1>"
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def main():
    ap = argparse.ArgumentParser(description="Get a Spotify refresh token")
    ap.add_argument("--client-id", required=True)
    ap.add_argument("--client-secret", required=True)
    args = ap.parse_args()

    auth_url = "https://accounts.spotify.com/authorize?" + urllib.parse.urlencode({
        "client_id": args.client_id,
        "response_type": "code",
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPES,
    })

    server = HTTPServer(("127.0.0.1", 8888), Handler)
    thread = threading.Thread(target=server.handle_request)
    thread.start()

    print("Opening browser for Spotify consent...")
    print("If it does not open, visit:\n" + auth_url)
    webbrowser.open(auth_url)
    thread.join(timeout=300)
    server.server_close()

    code = code_holder.get("code")
    if not code:
        sys.exit("No authorization code received (timed out after 5 minutes).")

    basic = base64.b64encode(f"{args.client_id}:{args.client_secret}".encode()).decode()
    data = urllib.parse.urlencode({
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT_URI,
    }).encode()
    req = urllib.request.Request(
        "https://accounts.spotify.com/api/token",
        data=data,
        headers={"Authorization": f"Basic {basic}", "Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req) as resp:
        tokens = json.load(resp)

    refresh = tokens.get("refresh_token")
    if not refresh:
        sys.exit(f"No refresh token in response: {tokens}")
    print("\nYour refresh token (feed it to `wrangler secret put SPOTIFY_REFRESH_TOKEN`):\n")
    print(refresh)


if __name__ == "__main__":
    main()
