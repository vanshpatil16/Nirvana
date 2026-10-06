/**
 * Profile-view counter backing GET/POST /api/views (shown only on /secret).
 *
 * The tally lives in Abacus (https://abacus.jasoncameron.dev), the free
 * no-signup successor to countapi.xyz: /get/{ns}/{key} reads a counter,
 * /hit/{ns}/{key} increments it atomically and returns the new value. We proxy
 * it through this app's own API so the third-party host never enters the client
 * bundle and every read degrades to a friendly "unavailable" instead of a
 * broken page when the counter is down.
 *
 * Runtime constraints: edge-compatible only (fetch / URL / Response), no Node
 * APIs. Counters are public — nothing sensitive is ever stored here.
 */

const COUNTER_BASE = "https://abacus.jasoncameron.dev";
// Pick something unlikely to collide with another Abacus user's namespace.
const NAMESPACE = "bhuniti-nirvana-c4a9";
const COUNTER_KEY = "profile-views";
const FETCH_TIMEOUT_MS = 5_000;

export interface ViewsPayload {
  count: number | null;
}

async function requestCounter(action: "get" | "hit"): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${COUNTER_BASE}/${action}/${NAMESPACE}/${COUNTER_KEY}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    // A counter nobody has hit yet is a 404 with an empty body. Reads report
    // that as 0 so the first visitor sees a number, not an outage.
    if (response.status === 404) return action === "get" ? 0 : null;
    if (!response.ok) return null;
    const payload = (await response.json()) as { value?: unknown };
    const value = Number(payload.value);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Current total without touching it. */
export function getProfileViews(): Promise<number | null> {
  return requestCounter("get");
}

/** Increment by one and return the new total. */
export function hitProfileViews(): Promise<number | null> {
  return requestCounter("hit");
}

/**
 * GET  /api/views      -> { count }  (read only)
 * POST /api/views      -> { count }  (increment, then report)
 *
 * Always 200 with `count: null` when the upstream counter is unreachable, so
 * callers can distinguish "no data yet" from a real outage.
 */
export async function handleViewsApi(request: Request): Promise<Response> {
  const count = request.method === "POST" ? await hitProfileViews() : await getProfileViews();
  const payload: ViewsPayload = { count };
  return Response.json(payload, {
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
