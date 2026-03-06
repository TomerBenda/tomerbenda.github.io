// Cloudflare Worker — view counter for tbd.codes
//
// API (all GET):
//   /{key}      → { key, count }   (read only)
//   /{key}/up   → { key, count }   (increment then read)
//
// Requires a KV namespace bound as COUNTS (see wrangler.toml or dashboard setup).

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
    const increment = parts[1] === "up";

    if (!key) {
      return json({ error: "missing key" }, 400, cors);
    }

    const stored = await env.COUNTS.get(key);
    let count = parseInt(stored ?? "0", 10);

    if (increment) {
      count++;
      await env.COUNTS.put(key, String(count));
    }

    return json({ key, count }, 200, cors);
  },
};

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
