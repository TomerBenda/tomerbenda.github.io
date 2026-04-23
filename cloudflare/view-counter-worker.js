// Cloudflare Worker — view counter for tbd.codes
//
// API (all GET):
//   /{key}      → { key, count }   (read only)
//   /{key}/up   → { key, count }   (increment then read)
//   /all        → { key: count, ... }  (requires Authorization: Bearer {STATS_SECRET})
//
// Requires a KV namespace bound as COUNTS (see wrangler.toml or dashboard setup).
// Set the stats passphrase via: wrangler secret put STATS_SECRET

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const parts = new URL(request.url).pathname.replace(/^\//, "").split("/");
    const key = decodeURIComponent(parts[0] || "");

    if (!key) {
      return json({ error: "missing key" }, 400, cors);
    }

    if (key === "all") {
      const auth = request.headers.get("Authorization");
      if (!env.STATS_SECRET || auth !== `Bearer ${env.STATS_SECRET}`) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      const allKeys = await listAllKeys(env.COUNTS);
      const entries = await Promise.all(
        allKeys.map(async ({ name }) => {
          const val = await env.COUNTS.get(name);
          return [name, parseInt(val ?? "0", 10)];
        })
      );
      return json(Object.fromEntries(entries), 200, cors);
    }

    const increment = parts[1] === "up";
    const stored = await env.COUNTS.get(key);
    let count = parseInt(stored ?? "0", 10);

    if (increment) {
      count++;
      await env.COUNTS.put(key, String(count));
    }

    return json({ key, count }, 200, cors);
  },
};

async function listAllKeys(namespace) {
  const keys = [];
  let cursor;
  do {
    const result = await namespace.list(cursor ? { cursor } : {});
    keys.push(...result.keys);
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
  return keys;
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
