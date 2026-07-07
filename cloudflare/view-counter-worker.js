// Cloudflare Worker — view counter for tbd.codes
//
// API (all GET):
//   /{key}      → { key, count }   (read only)
//   /{key}/up   → { key, count }   (increment then read)
//   /all        → { key: count, ... }  (requires Authorization: Bearer {STATS_SECRET})
//   /history    → { "YYYY-MM-DD": total, ... }  (requires the same Bearer)
//
// A daily cron snapshots the total into __history:<date> keys so the stats
// dashboard can chart reads over time (KV stores lifetime counters only).
//
// Requires a KV namespace bound as COUNTS (see wrangler.toml or dashboard setup).
// Set the stats passphrase via: wrangler secret put STATS_SECRET

const HISTORY_PREFIX = "__history:";

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const parts = new URL(request.url).pathname.replace(/^\//, "").split("/");
    const key = decodeURIComponent(parts[0] || "");

    if (!key) {
      return json({ error: "missing key" }, 400, cors);
    }

    if (key === "all" || key === "history") {
      const auth = request.headers.get("Authorization");
      if (!env.STATS_SECRET || auth !== `Bearer ${env.STATS_SECRET}`) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      const allKeys = await listAllKeys(env.COUNTS);
      const wantHistory = key === "history";
      const selected = allKeys.filter(({ name }) =>
        wantHistory ? name.startsWith(HISTORY_PREFIX) : !name.startsWith(HISTORY_PREFIX)
      );
      const entries = await Promise.all(
        selected.map(async ({ name }) => {
          const val = await env.COUNTS.get(name);
          const outName = wantHistory ? name.slice(HISTORY_PREFIX.length) : name;
          return [outName, parseInt(val ?? "0", 10)];
        })
      );
      return json(Object.fromEntries(entries), 200, cors);
    }

    if (key.startsWith("__")) {
      return json({ error: "reserved key" }, 400, cors);
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

  // Daily snapshot: total reads → __history:<YYYY-MM-DD>
  async scheduled(event, env) {
    const allKeys = await listAllKeys(env.COUNTS);
    const countKeys = allKeys.filter(({ name }) => !name.startsWith(HISTORY_PREFIX));
    let total = 0;
    for (const { name } of countKeys) {
      const val = await env.COUNTS.get(name);
      total += parseInt(val ?? "0", 10);
    }
    const date = new Date(event.scheduledTime).toISOString().slice(0, 10);
    await env.COUNTS.put(HISTORY_PREFIX + date, String(total));
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
