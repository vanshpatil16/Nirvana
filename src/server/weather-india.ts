/**
 * Live IMD (India Meteorological Department) weather proxy backing
 * GET /api/weather/*.
 *
 * Approach follows rtdtwo/india-weather-rest (MIT): a curated station list
 * plus a per-station scrape of IMD's city weather page. The repo's original
 * HTML <td> scraper broke when IMD shipped their React SPA, so we call the
 * JSON API that SPA itself uses (fetchCity_static.php) instead â€” same fields
 * (max/min temp, departure, rainfall, humidity, sunrise/sunset, 7-day
 * forecast, station lat/lon) without parsing HTML.
 *
 * Runtime constraints: edge-compatible only (fetch / URLSearchParams / Map),
 * no Node APIs. Responses are cached in-memory per isolate so repeated map
 * loads stay polite to IMD's servers.
 */

import stations from "@/data/imd-stations.json";

const IMD_ENDPOINT = "https://city.imd.gov.in/citywx/responsive/api/fetchCity_static.php";

const IMD_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Referer: "https://city.imd.gov.in/citywx/responsive/",
  Origin: "https://city.imd.gov.in",
  Accept: "application/json, text/plain, */*",
  "X-Requested-With": "XMLHttpRequest",
};

export interface ImdStation {
  stationId: number;
  station: string;
  jurisdiction: string;
  region: string;
}

export interface ImdForecastDay {
  day: number;
  max: number | null;
  min: number | null;
  condition: string;
}

export interface ImdWeather {
  id: number;
  name: string;
  place: string;
  region: string;
  lat: number | null;
  lon: number | null;
  observedAt: string | null;
  updatedAt: string | null;
  tempMax: number | null;
  tempMaxDeparture: number | null;
  tempMin: number | null;
  rainfall: number | null;
  humidityMorning: number | null;
  humidityEvening: number | null;
  sunrise: string | null;
  sunset: string | null;
  forecast: ImdForecastDay[];
}

const STATIONS = stations as ImdStation[];

const CACHE_OK_MS = 45 * 60_000;
const CACHE_FAIL_MS = 5 * 60_000;
const FETCH_TIMEOUT_MS = 10_000;

interface CacheEntry {
  at: number;
  ok: boolean;
  data: ImdWeather | null;
}

const cache = new Map<number, CacheEntry>();

/** IMD marks missing readings with sentinels (their SPA checks 99.9/999). */
function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text === "" || text === "99.9" || text === "999" || text === "9999" || text === "9999.9") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function normalize(id: number, raw: Record<string, unknown>): ImdWeather {
  const meta = STATIONS.find((s) => s.stationId === id);
  const lat = num(raw["lat"]);
  const lon = num(raw["lon"]);
  const forecast: ImdForecastDay[] = [];
  for (let i = 0; i < 7; i += 1) {
    const condition = text(raw[`forecast${i}`]);
    if (!condition) continue;
    forecast.push({
      day: i + 1,
      max: num(raw[`max${i}`]),
      min: num(raw[`min${i}`]),
      condition,
    });
  }
  return {
    id,
    name: text(raw["station"]) ?? meta?.station ?? `Station ${id}`,
    place: meta?.jurisdiction ?? text(raw["station"]) ?? "",
    region: meta?.region ?? "",
    lat: lat !== null && lat >= -90 && lat <= 90 ? lat : null,
    lon: lon !== null && lon >= -180 && lon <= 180 ? lon : null,
    observedAt: text(raw["dat"]),
    updatedAt: text(raw["updat"]),
    tempMax: num(raw["max"]),
    tempMaxDeparture: num(raw["maxdep"]),
    tempMin: num(raw["min"]),
    rainfall: num(raw["rainfall"]),
    humidityMorning: num(raw["rh0830"]),
    humidityEvening: num(raw["rh1730"]),
    sunrise: text(raw["sunrise"]),
    sunset: text(raw["sunset"]),
    forecast,
  };
}

async function fetchStation(id: number): Promise<ImdWeather> {
  const cached = cache.get(id);
  if (cached && Date.now() - cached.at < (cached.ok ? CACHE_OK_MS : CACHE_FAIL_MS)) {
    if (cached.ok && cached.data) return cached.data;
    throw new Error(`IMD station ${id} cached failure`);
  }
  try {
    const body = new URLSearchParams({ ID: String(id) });
    const response = await fetch(IMD_ENDPOINT, {
      method: "POST",
      headers: { ...IMD_HEADERS, "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`IMD responded ${response.status}`);
    const payload: unknown = await response.json();
    const row = Array.isArray(payload) ? payload[0] : payload;
    if (!row || typeof row !== "object") throw new Error("IMD returned no station payload");
    const weather = normalize(id, row as Record<string, unknown>);
    if (weather.lat === null || weather.lon === null) throw new Error(`IMD station ${id} missing coordinates`);
    cache.set(id, { at: Date.now(), ok: true, data: weather });
    return weather;
  } catch (error) {
    cache.set(id, { at: Date.now(), ok: false, data: null });
    throw error;
  }
}

/** Bounded fan-out so a cold summary never hammers IMD in one burst. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      try {
        results[index] = { status: "fulfilled", value: await fn(items[index] as T) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

async function buildSummary(): Promise<{ generatedAt: string; count: number; failed: number; stations: ImdWeather[] }> {
  const settled = await mapWithConcurrency(STATIONS, 6, (station) => fetchStation(station.stationId));
  const list: ImdWeather[] = [];
  let failed = 0;
  for (const entry of settled) {
    if (entry.status === "fulfilled") list.push(entry.value);
    else failed += 1;
  }
  list.sort((a, b) => a.region.localeCompare(b.region) || a.name.localeCompare(b.name));
  return { generatedAt: new Date().toISOString(), count: list.length, failed, stations: list };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json;charset=utf-8", "cache-control": "public, max-age=300" },
  });
}

export async function handleWeatherApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  if (url.pathname === "/api/weather/stations") {
    return json({ stations: STATIONS });
  }

  if (url.pathname === "/api/weather/station") {
    const id = Number(url.searchParams.get("id"));
    const station = STATIONS.find((s) => s.stationId === id);
    if (!station) return json({ error: `Unknown station id` }, 404);
    try {
      return json({ station: await fetchStation(id) });
    } catch {
      return json({ error: "IMD temporarily unavailable" }, 502);
    }
  }

  if (url.pathname === "/api/weather/summary") {
    try {
      return json(await buildSummary());
    } catch {
      return json({ error: "IMD temporarily unavailable" }, 502);
    }
  }

  return json({ error: "Not found" }, 404);
}
