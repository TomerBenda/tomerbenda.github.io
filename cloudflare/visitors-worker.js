// Cloudflare Worker — shared visitor memory for tbd.codes
//
// API:
//   GET  /meltdown            → { attempts, vandals }
//   POST /meltdown            → increment; body {first:true} also counts a new vandal
//   GET  /presence            → { here }               (heartbeats seen in the last 5 min)
//   POST /presence {id}       → heartbeat; returns { here }
//   GET  /wall                → { messages: [{text, ts}, …] }  (latest 10, newest first)
//   POST /wall {text}         → add a line (≤120 chars, 3/hour per IP)
//   GET  /wall/all            → every message with keys (Bearer STATS_SECRET)
//   POST /wall/delete {key}   → remove one (Bearer STATS_SECRET)
//
// Setup: create a KV namespace bound as VISITORS, `wrangler secret put
// STATS_SECRET -c visitors-wrangler.toml` (same passphrase as the other
// workers), then `wrangler deploy -c visitors-wrangler.toml`.

const ALLOWED_ORIGINS = ["https://tbd.codes", "http://localhost:8080", "http://127.0.0.1:8080"];
const WALL_MAX = 120;
const WALL_KEEP = 50;
const WALL_RATE = 3; // per hour per IP
const PRESENCE_TTL = 300; // seconds

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Vary": "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const path = new URL(request.url).pathname.replace(/\/+$/, "");

    try {
      if (path === "/meltdown") return await meltdown(request, env, cors);
      if (path === "/presence") return await presence(request, env, cors);
      if (path === "/wall") return await wall(request, env, cors);
      if (path === "/wall/all") return await wallAll(request, env, cors);
      if (path === "/wall/delete") return await wallDelete(request, env, cors);
    } catch (e) {
      return json({ error: String(e).slice(0, 100) }, 500, cors);
    }
    return json({ error: "not found" }, 404, cors);
  },
};

async function meltdown(request, env, cors) {
  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const attempts = parseInt((await env.VISITORS.get("meltdown:attempts")) ?? "0", 10) + 1;
    await env.VISITORS.put("meltdown:attempts", String(attempts));
    let vandals = parseInt((await env.VISITORS.get("meltdown:vandals")) ?? "0", 10);
    if (body.first) {
      vandals++;
      await env.VISITORS.put("meltdown:vandals", String(vandals));
    }
    return json({ attempts, vandals }, 200, cors);
  }
  const attempts = parseInt((await env.VISITORS.get("meltdown:attempts")) ?? "0", 10);
  const vandals = parseInt((await env.VISITORS.get("meltdown:vandals")) ?? "0", 10);
  return json({ attempts, vandals }, 200, cors);
}

async function presence(request, env, cors) {
  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "").replace(/[^a-z0-9-]/gi, "").slice(0, 40);
    if (id) await env.VISITORS.put("p:" + id, "1", { expirationTtl: PRESENCE_TTL });
  }
  const list = await env.VISITORS.list({ prefix: "p:" });
  return json({ here: list.keys.length }, 200, cors);
}

async function wall(request, env, cors) {
  if (request.method === "POST") {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const rlKey = "rl:" + ip;
    const used = parseInt((await env.VISITORS.get(rlKey)) ?? "0", 10);
    if (used >= WALL_RATE) return json({ error: "rate limited" }, 429, cors);

    const body = await request.json().catch(() => ({}));
    const text = String(body.text || "").replace(/\s+/g, " ").trim();
    if (!text) return json({ error: "empty" }, 400, cors);
    if (text.length > WALL_MAX) return json({ error: "too long" }, 400, cors);

    const ts = Date.now();
    await env.VISITORS.put(
      "w:" + String(ts).padStart(15, "0") + ":" + Math.random().toString(36).slice(2, 8),
      JSON.stringify({ text, ts })
    );
    await env.VISITORS.put(rlKey, String(used + 1), { expirationTtl: 3600 });

    // Keep the wall finite: prune beyond the newest WALL_KEEP
    const all = await env.VISITORS.list({ prefix: "w:" });
    if (all.keys.length > WALL_KEEP) {
      const excess = all.keys.slice(0, all.keys.length - WALL_KEEP); // list is key-ordered = oldest first
      for (const k of excess) await env.VISITORS.delete(k.name);
    }
    return json({ ok: true }, 200, cors);
  }

  const list = await env.VISITORS.list({ prefix: "w:" });
  const latest = list.keys.slice(-10).reverse();
  const messages = [];
  for (const k of latest) {
    const val = await env.VISITORS.get(k.name);
    if (val) messages.push(JSON.parse(val));
  }
  return json({ messages }, 200, cors);
}

function authed(request, env) {
  const auth = request.headers.get("Authorization");
  return env.STATS_SECRET && auth === `Bearer ${env.STATS_SECRET}`;
}

async function wallAll(request, env, cors) {
  if (!authed(request, env)) return json({ error: "unauthorized" }, 401, cors);
  const list = await env.VISITORS.list({ prefix: "w:" });
  const messages = [];
  for (const k of list.keys) {
    const val = await env.VISITORS.get(k.name);
    if (val) messages.push({ key: k.name, ...JSON.parse(val) });
  }
  return json({ messages }, 200, cors);
}

async function wallDelete(request, env, cors) {
  if (!authed(request, env)) return json({ error: "unauthorized" }, 401, cors);
  const body = await request.json().catch(() => ({}));
  if (!body.key || !String(body.key).startsWith("w:")) return json({ error: "bad key" }, 400, cors);
  await env.VISITORS.delete(String(body.key));
  return json({ ok: true }, 200, cors);
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
