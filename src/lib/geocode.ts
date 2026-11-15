// Place search via OpenStreetMap Nominatim (https://operations.osmfoundation.org/policies/nominatim/):
// search on submit only (no autocomplete), max ~1 request/second, show attribution.
export interface Place {
  name: string;
  lat: number;
  lon: number;
  /** [south, north, west, east] */
  bbox: [number, number, number, number];
}

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
let last = 0;

export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  const query = q.trim();
  if (!query) return [];
  const wait = 1100 - (Date.now() - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const url = `${ENDPOINT}?${new URLSearchParams({ format: "jsonv2", q: query, limit: "6", "accept-language": "en" })}`;
  const r = await fetch(url, { signal: signal ?? AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`Search failed (HTTP ${r.status})`);
  const rows = (await r.json()) as { display_name: string; lat: string; lon: string; boundingbox: [string, string, string, string] }[];
  return rows.map((x) => ({
    name: x.display_name,
    lat: Number(x.lat),
    lon: Number(x.lon),
    bbox: x.boundingbox.map(Number) as [number, number, number, number],
  }));
}