/**
 * Same-origin read-only proxy for the Land Stack API gateway (FastAPI on Render).
 *
 * Why this exists: the gateway's CORS allowlist is deliberately narrow, so a
 * browser on a Vercel deployment URL, a preview build, or the compatibility
 * alias would be blocked. Proxying server-side makes the gateway readable from
 * every host this app is served on, and lets us keep the gateway's own CORS
 * strict instead of opening it to `*.vercel.app`.
 *
 * This is a transport shim, not a merge of the two services: the gateway keeps
 * owning data, auth roles, rate limits and provenance. This only forwards
 * already-public read endpoints.
 *
 * Edge-compatible only (fetch / URL / URLSearchParams), no Node APIs.
 */

/**
 * Read-only allowlist. Anything not matching is refused, so this cannot be
 * turned into an open proxy for the gateway's write or credentialed routes.
 */
const ALLOWED_PREFIXES = [
  "/api/v1/sources",
  "/api/v1/sources/health",
  "/api/v1/land-records/index",
  "/api/v1/geocode",
  "/collections",
  "/stac",
];

const BASE_URL = (
  process.env["LANDSTACK_URL"] || "https://bhumi-niti-landstack.onrender.com"
).replace(/\/+$/, "");

/**
 * Budgets are per path, not global, and kept well inside the serverless
 * function ceiling (vercel.json caps the entry at 60s). The health endpoint is
 * the slow one: it still touches ISRO Bhuvan and Nominatim even with
 * probe=false, which takes ~25s from Render and is not worth blocking a click
 * for, so it gets a short budget and the page degrades to credential status
 * rather than hanging.
 */
const HEALTH_PATH = "/api/v1/sources/health";
const DEFAULT_TIMEOUT_MS = 15_000;
const HEALTH_TIMEOUT_MS = 12_000;

const timeoutFor = (bare: string) =>
  bare.startsWith(HEALTH_PATH) ? HEALTH_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

/** Gateway responses are near-static; a short cache keeps the page snappy. */
const CACHE_OK_MS = 60_000;
const CACHE_FAIL_MS = 20_000;

interface CacheEntry {
  at: number;
  ttl: number;
  body: string;
  status: number;
}

const cache = new Map<string, CacheEntry>();
const cacheSizeCap = 200;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json;charset=utf-8" },
  });
}

function isAllowed(path: string): boolean {
  return ALLOWED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}?`) || path.startsWith(`${prefix}/`),
  );
}

export async function handleLandStackProxy(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return json({ error: "The NIRVANA proxy exposes read-only GET endpoints." }, 405);
  }

  const url = new URL(request.url);
  const upstreamPath = url.searchParams.get("path") ?? "";
  if (!upstreamPath || !upstreamPath.startsWith("/")) {
    return json({ error: "Missing or invalid ?path= parameter." }, 400);
  }

  // Allowlist on the bare path only, so a caller cannot smuggle a different
  // route in through the query string. The rest is forwarded verbatim because
  // upstream parameters such as `probe=false` or `bbox=...` are meaningful.
  const bare = upstreamPath.split("?")[0] ?? upstreamPath;
  if (!isAllowed(bare)) {
    return json({ error: `Path not proxied: ${bare}` }, 403);
  }

  const target = `${BASE_URL}${upstreamPath}`;
  const cacheKey = target;

  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < hit.ttl) {
    return new Response(hit.body, {
      status: hit.status,
      headers: { "content-type": "application/json;charset=utf-8", "x-landstack-cache": "hit" },
    });
  }
  const budget = timeoutFor(bare);
  // Retry only when the connection failed outright. A timeout means the
  // upstream is genuinely still working on it (Overpass-backed bbox queries
  // routinely take tens of seconds), and retrying would just double the wait,
  // so timeouts are reported straight away instead.
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(target, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(budget),
      });
      const body = await response.text();

      // A rate-limit response is the gateway's own verdict, not a failure to
      // reach it: pass it straight through and do not cache it as our error.
      if (response.status === 429) {
        return json(
          {
            error:
              "The Land Stack gateway is rate-limiting requests right now. Wait a moment and try again.",
          },
          429,
        );
      }

      if (cache.size >= cacheSizeCap) {
        // Cheap FIFO trim; the map is small and per-isolate.
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      cache.set(cacheKey, {
        at: Date.now(),
        ttl: response.ok ? CACHE_OK_MS : CACHE_FAIL_MS,
        body,
        status: response.status,
      });

      return new Response(body, {
        status: response.status,
        headers: {
          "content-type": response.headers.get("content-type") ?? "application/json;charset=utf-8",
          "cache-control": response.ok ? "public, max-age=60" : "no-store",
        },
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      if (!aborted && attempt < maxAttempts) {
        // Connection-level failure: one quick retry often lands.
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
      return json(
        {
          error: aborted
            ? `The Land Stack gateway took longer than ${Math.round(budget / 1000)}s on this query. It is still working — try again shortly.`
            : "The Land Stack gateway is unreachable.",
        },
        aborted ? 504 : 502,
      );
    }
  }

  return json({ error: "The Land Stack gateway could not be reached." }, 502);
}
