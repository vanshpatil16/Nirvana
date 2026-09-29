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

const UPSTREAM_TIMEOUT_MS = 20_000;

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

  // Strip any query string the caller smuggled into ?path= so the only thing
  // forwarded is the allowlisted path; the caller's own params are passed on.
  const bare = upstreamPath.split("?")[0] ?? upstreamPath;
  if (!isAllowed(bare)) {
    return json({ error: `Path not proxied: ${bare}` }, 403);
  }

  const callerQuery = url.searchParams.get("query") ?? "";
  const target = `${BASE_URL}${bare}${callerQuery ? `?${callerQuery}` : ""}`;
  const cacheKey = target;

  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < hit.ttl) {
    return new Response(hit.body, {
      status: hit.status,
      headers: { "content-type": "application/json;charset=utf-8", "x-landstack-cache": "hit" },
    });
  }

  try {
    const response = await fetch(target, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const body = await response.text();

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
    return json(
      {
        error: aborted
          ? "The Land Stack gateway did not respond in time (it may be waking up)."
          : "The Land Stack gateway is unreachable.",
      },
      504,
    );
  }
}
