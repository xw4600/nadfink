// Cloudflare Worker backing the nadfink.com page counter.
//
// GET /hit?key=<id>  - increment a page counter and the site total
// GET /get?key=<id>  - read a counter without incrementing it
// GET /health        - liveness check

const SITE_KEY = "__site__";
const UPSERT =
  "INSERT INTO page_views (key, count) VALUES (?, 1) " +
  "ON CONFLICT(key) DO UPDATE SET count = count + 1";
const SELECT = "SELECT count FROM page_views WHERE key = ?";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS,
    },
  });
}

function validKey(key) {
  return typeof key === "string" && key.length > 0 && key.length <= 64 &&
    /^[A-Za-z0-9_.:-]+$/.test(key);
}

function isPassive(request) {
  const ua = (request.headers.get("user-agent") || "").toLowerCase();
  const purpose = (request.headers.get("purpose") || "").toLowerCase();
  return purpose.includes("prefetch") ||
    /bot|crawler|spider|slurp|facebookexternalhit|preview|monitor/i.test(ua);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== "GET") {
      return json({ error: "method not allowed" }, 405);
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    if (url.pathname !== "/hit" && url.pathname !== "/get") {
      return json({ error: "not found" }, 404);
    }

    const key = url.searchParams.get("key");
    if (!validKey(key)) {
      return json({ error: "invalid key" }, 400);
    }

    const db = env.DB;
    const counting = url.pathname === "/hit" && !isPassive(request);

    if (counting) {
      await db.batch([
        db.prepare(UPSERT).bind(key),
        db.prepare(UPSERT).bind(SITE_KEY),
      ]);
    }

    const [pageResult, siteResult] = await db.batch([
      db.prepare(SELECT).bind(key),
      db.prepare(SELECT).bind(SITE_KEY),
    ]);

    return json({
      key,
      count: pageResult.results[0]?.count ?? 0,
      total: siteResult.results[0]?.count ?? 0,
      counted: counting,
    });
  },
};

// coded by Big Pickle
