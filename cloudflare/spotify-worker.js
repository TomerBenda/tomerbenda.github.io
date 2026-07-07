// Cloudflare Worker — Spotify now-playing for tbd.codes
//
// API:
//   GET /now → { playing: bool, track, artist, art, url } | { playing: false }
//
// Secrets (wrangler secret put ...): SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET,
// SPOTIFY_REFRESH_TOKEN. See cloudflare/SPOTIFY_SETUP.md for the one-time setup.
// Responses are cached ~30s at the edge to stay far from Spotify rate limits.

const ALLOWED_ORIGINS = ["https://tbd.codes", "http://localhost:8080", "http://127.0.0.1:8080"];

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Vary": "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname !== "/now") return json({ error: "not found" }, 404, cors);

    const cacheKey = new Request("https://tbd-spotify.cache/now");
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) {
      const body = await cached.text();
      return new Response(body, { headers: { ...cors, "Content-Type": "application/json" } });
    }

    try {
      const token = await accessToken(env);
      let payload = await nowPlaying(token);
      if (!payload) payload = await lastPlayed(token);
      if (!payload) payload = { playing: false };
      const res = json(payload, 200, { ...cors, "Cache-Control": "s-maxage=30" });
      ctx.waitUntil(cache.put(cacheKey, res.clone()));
      return res;
    } catch (e) {
      // Widget-friendly: errors surface as "nothing playing", never break the page
      return json({ playing: false, error: String(e).slice(0, 100) }, 200, cors);
    }
  },
};

async function accessToken(env) {
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`),
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: env.SPOTIFY_REFRESH_TOKEN }),
  });
  if (!r.ok) throw new Error(`token ${r.status}`);
  return (await r.json()).access_token;
}

function trackPayload(item, playing) {
  return {
    playing,
    track: item.name,
    artist: (item.artists || []).map((a) => a.name).join(", "),
    art: item.album && item.album.images && item.album.images[1] ? item.album.images[1].url : null,
    url: item.external_urls ? item.external_urls.spotify : null,
  };
}

async function nowPlaying(token) {
  const r = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status !== 200) return null; // 204 = nothing playing
  const data = await r.json();
  if (!data || !data.item) return null;
  return trackPayload(data.item, !!data.is_playing);
}

async function lastPlayed(token) {
  const r = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=1", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const data = await r.json();
  const item = data.items && data.items[0] && data.items[0].track;
  return item ? trackPayload(item, false) : null;
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
