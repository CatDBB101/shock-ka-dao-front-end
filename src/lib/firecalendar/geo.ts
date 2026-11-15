// Hexagon AOI geometry (map drawing). Rings are [lon, lat] like GeoJSON.
import type { Box } from "./types";
import { FireCalendarError } from "./errors";

export type LonLat = [number, number];
export interface Hexagon {
  lat: number;
  lon: number;
  radiusKm: number;
}

export const HEX_MIN_KM = 5;
export const HEX_MAX_KM = 800;
const R_EARTH = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function haversineKm(a: LonLat, b: LonLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point at distance/bearing on a sphere. */
export function destination([lon, lat]: LonLat, km: number, bearingDeg: number): LonLat {
  const d = km / R_EARTH;
  const b = rad(bearingDeg);
  const p1 = rad(lat);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = rad(lon) + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [((deg(l2) + 540) % 360) - 180, deg(p2)];
}

/** Regular hexagon (6 vertices, pointy-top), closed ring. */
export function hexagonRing(h: Hexagon): LonLat[] {
  const ring = Array.from({ length: 6 }, (_, i) => destination([h.lon, h.lat], h.radiusKm, i * 60));
  return [...ring, ring[0]!];
}

export function ringBox(ring: LonLat[]): Box {
  const lons = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  const r = (n: number) => Math.round(n * 1e4) / 1e4;
  return { minLat: r(Math.min(...lats)), minLon: r(Math.min(...lons)), maxLat: r(Math.max(...lats)), maxLon: r(Math.max(...lons)) };
}

/** Ray casting; fine for AOIs well under a hemisphere. */
export function pointInRing(lon: number, lat: number, ring: LonLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function validateHexagon(h: Hexagon): void {
  const bad = (m: string) => new FireCalendarError("validation", m, 400);
  if (![h.lat, h.lon, h.radiusKm].every(Number.isFinite)) throw bad("Invalid hexagon");
  if (h.radiusKm < HEX_MIN_KM) throw bad(`Hexagon too small (radius at least ${HEX_MIN_KM} km)`);
  if (h.radiusKm > HEX_MAX_KM) throw bad(`Hexagon too large (radius at most ${HEX_MAX_KM} km)`);
  const b = ringBox(hexagonRing(h));
  if (b.minLat < -90 || b.maxLat > 90) throw bad("Hexagon extends past a pole");
  if (b.maxLon - b.minLon > 180) throw bad("Hexagons crossing the 180° meridian are not supported yet");
}

/** URL: hex=lat,lon,radiusKm */
export function readHexFromUrl(sp: URLSearchParams): Hexagon | null {
  const p = sp.get("hex")?.split(",").map(Number);
  if (!p || p.length !== 3 || p.some((n) => !Number.isFinite(n))) return null;
  const [lat, lon, radiusKm] = p as [number, number, number];
  return { lat, lon, radiusKm };
}
export const hexToParam = (h: Hexagon) => [h.lat.toFixed(4), h.lon.toFixed(4), h.radiusKm.toFixed(1)].join(",");
