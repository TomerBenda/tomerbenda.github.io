// Cloudflare Worker — emoji reactions for tbd.codes
//
// API:
//   GET  /reactions/{filename}          → { "👍": 5, "❤️": 2, ... }
//   POST /reactions/{filename}/{emoji}  → { emoji, count }
//   GET  /reactions/all                 → { filename: { emoji: count }, ... }  (requires Authorization: Bearer {STATS_SECRET})
//
// Requires a KV namespace bound as REACTIONS.
// Counts are stored as a JSON object per post: key = filename, value = { emoji: count, ... }
// Set the stats passphrase via: wrangler secret put STATS_SECRET

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const parts = new URL(request.url).pathname.replace(/^\//, "").split("/");

    if (parts[0] !== "reactions") return json({ error: "not found" }, 404, cors);

    const filename = decodeURIComponent(parts[1] || "");
    if (!filename) return json({ error: "missing filename" }, 400, cors);

    if (filename === "all") {
      const auth = request.headers.get("Authorization");
      if (!env.STATS_SECRET || auth !== `Bearer ${env.STATS_SECRET}`) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      const allKeys = await listAllKeys(env.REACTIONS);
      const entries = await Promise.all(
        allKeys.map(async ({ name }) => {
          const val = await env.REACTIONS.get(name);
          return [name, val ? JSON.parse(val) : {}];
        })
      );
      return json(Object.fromEntries(entries), 200, cors);
    }

    if (request.method === "GET") {
      const stored = await env.REACTIONS.get(filename);
      return json(stored ? JSON.parse(stored) : {}, 200, cors);
    }

    if (request.method === "POST") {
      const emoji = parts[2] ? decodeURIComponent(parts[2]) : null;
      if (!emoji) return json({ error: "missing emoji" }, 400, cors);
      const stored = await env.REACTIONS.get(filename);
      const counts = stored ? JSON.parse(stored) : {};
      counts[emoji] = (counts[emoji] || 0) + 1;
      await env.REACTIONS.put(filename, JSON.stringify(counts));
      return json({ emoji, count: counts[emoji] }, 200, cors);
    }

    return json({ error: "method not allowed" }, 405, cors);
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
