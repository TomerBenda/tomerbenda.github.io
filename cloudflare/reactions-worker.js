// Cloudflare Worker — emoji reactions for tbd.codes
//
// API:
//   GET  /reactions/{filename}          → { "👍": 5, "❤️": 2, ... }
//   POST /reactions/{filename}/{emoji}  → { emoji, count }
//
// Requires a KV namespace bound as REACTIONS.
// Counts are stored as a JSON object per post: key = filename, value = { emoji: count, ... }

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

    // Expect /reactions/{filename}[/{emoji}]
    if (parts[0] !== "reactions") return json({ error: "not found" }, 404, cors);

    const filename = decodeURIComponent(parts[1] || "");
    if (!filename) return json({ error: "missing filename" }, 400, cors);

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

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
