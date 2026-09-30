/**
 * Thin client for the Land Stack API (the FastAPI integration gateway).
 *
 * Reads go through the app's own `/api/landstack` proxy rather than straight to
 * the gateway, because the gateway's CORS allowlist only covers the primary
 * domain. The proxy is a transport shim only — the gateway still owns data,
 * auth, rate limits and provenance. `LANDSTACK_BASE_URL` below is used for
 * display and for plain navigation links (docs, STAC catalog), which are not
 * subject to CORS.
 *
 * Everything here is read-only and best-effort: the page that uses it must
 * render even when the gateway is asleep, rate-limited or unconfigured, so every
 * call resolves to `{ ok: false, reason }` rather than throwing.
 */

export const LANDSTACK_BASE_URL =
  (import.meta.env["VITE_LANDSTACK_URL"] as string | undefined)?.replace(/\/+$/, "") ||
  "https://bhumi-niti-landstack.onrender.com";

export interface LandStackSource {
  id: string;
  name: string;
  provider: string;
  url?: string | null;
  api_url?: string | null;
  category: string;
  auth: string;
  auth_env: string[];
  auth_notes?: string | null;
  evidence: string;
  license?: string | null;
  cadence?: string | null;
  searchable: boolean;
  search_notes?: string | null;
  limitations: string[];
  status: string;
  configured: boolean;
  unavailable_reason?: string | null;
  contains_personal_data?: boolean;
}

export interface LandStackCollection {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  "x-license"?: string | null;
  "x-attribution"?: string | null;
  "x-source"?: string | null;
  "x-item-kind"?: string;
  "x-caveats"?: string[];
  extent: { spatial: { bbox: number[][] } };
  itemType?: string;
  storageCrs?: string;
  "x-evidence"?: string;
}

export interface SourceHealth {
  status: "ok" | "degraded" | "slow" | "unconfigured" | "configured";
  detail?: string;
}

export type Result<T> = { ok: true; data: T; cached?: boolean } | { ok: false; reason: string };

/**
 * Client budgets sit deliberately above the proxy's, so a slow gateway surfaces
 * the proxy's explanatory error instead of a bare client-side abort.
 */
const TIMEOUT_MS = 25_000;

async function getJson<T>(path: string, timeoutMs = TIMEOUT_MS): Promise<Result<T>> {
  const params = new URLSearchParams({ path });
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`/api/landstack?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (!response.ok) {
      let reason = `HTTP ${response.status} from the gateway`;
      try {
        const body = (await response.json()) as { error?: string };
        if (body?.error) reason = body.error;
      } catch {
        // Non-JSON error body: keep the status-based message.
      }
      return { ok: false, reason };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    return {
      ok: false,
      reason:
        name === "AbortError"
          ? `The gateway did not respond within ${Math.round(timeoutMs / 1000)}s.`
          : "The gateway is unreachable from here.",
    };
  }
}

export function fetchSources(): Promise<Result<LandStackSource[]>> {
  return getJson<{ sources: LandStackSource[] }>("/api/v1/sources").then((r) =>
    r.ok ? { ok: true, data: r.data.sources } : r,
  );
}

export function fetchSourceHealth(): Promise<Result<Record<string, SourceHealth>>> {
  // Deliberately not part of the page load: even with `probe=false` the gateway
  // still touches Bhuvan and Nominatim and takes ~25s. Only call it on request,
  // with a timeout that can absorb that.
  return getJson<{ sources: Record<string, SourceHealth> }>(
    "/api/v1/sources/health?probe=false",
    55_000,
  ).then((r) => (r.ok ? { ok: true, data: r.data.sources } : r));
}

export function fetchCollections(): Promise<Result<LandStackCollection[]>> {
  return getJson<{ collections: LandStackCollection[] }>("/collections").then((r) =>
    r.ok ? { ok: true, data: r.data.collections } : r,
  );
}

export function fetchLandRecordsIndex(): Promise<
  Result<{ jurisdictions: number; with_public_portal: number; sanctioned_interfaces: number }>
> {
  return getJson("/api/v1/land-records/index");
}

/** Live feature count for a bbox, used by the collection "try it" affordance. */
export function countFeatures(
  collectionId: string,
  bbox: [number, number, number, number],
): Promise<Result<{ count: number; sample: unknown }>> {
  const b = bbox.join(",");
  return getJson<{ numberReturned: number; features: unknown[] }>(
    `/collections/${encodeURIComponent(collectionId)}/items?bbox=${b}&limit=5`,
  ).then((r) =>
    r.ok
      ? { ok: true, data: { count: r.data.numberReturned, sample: r.data.features[0] ?? null } }
      : r,
  );
}
