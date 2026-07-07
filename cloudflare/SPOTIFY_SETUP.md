# Spotify now-playing — one-time setup

The music page shows a live "now playing" line fed by the `tbd-spotify` worker.
Until these steps are done, the line simply stays hidden — nothing breaks.

1. **Create a Spotify app**: go to
   [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard),
   create an app (any name), and in its settings add this Redirect URI:

   ```
   http://127.0.0.1:8888/callback
   ```

   Note the **Client ID** and **Client Secret**.

2. **Get a refresh token** (one time, on your machine):

   ```bash
   python scripts/spotify_get_refresh_token.py --client-id <ID> --client-secret <SECRET>
   ```

   A browser tab opens for consent; the token prints to the terminal.

3. **Deploy the worker with secrets** (from the repo root):

   ```bash
   cd cloudflare
   wrangler secret put SPOTIFY_CLIENT_ID -c spotify-wrangler.toml
   wrangler secret put SPOTIFY_CLIENT_SECRET -c spotify-wrangler.toml
   wrangler secret put SPOTIFY_REFRESH_TOKEN -c spotify-wrangler.toml
   wrangler deploy -c spotify-wrangler.toml
   ```

4. **Check it**: `curl https://tbd-spotify.tomerno6.workers.dev/now` — you should
   see `{"playing":...}` JSON. Play something on Spotify and reload the music
   page; the `▶ now playing:` line appears in the header within ~45 s.

Scopes used: `user-read-currently-playing`, `user-read-recently-played` (read-only).
The worker caches responses for 30 s at the edge, so page traffic never hits
Spotify rate limits.
