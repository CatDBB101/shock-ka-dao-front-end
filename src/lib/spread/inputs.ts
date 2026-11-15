// Browser-side inputs for the spread simulator: forecast weather (Open-Meteo), terrain
// (AWS Terrain Tiles, Terrarium encoding) and the local metric grid around the ignition.
// Both services send `Access-Control-Allow-Origin: *` (checked Nov 2026).

import type { HourWeather } from "./moisture";

const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LON_EQ = 111_320;

/** Square grid centred on (lat, lon). Row 0 = north. */
export interface GridGeo {
  lat: number;
  lon: number;
  n: number;
  cell: number;
}

export function cellLonLat(g: GridGeo, x: number, y: number): [number, number] {
  const half = (g.n - 1) / 2;
  return [g.lon + ((x - half) * g.cell) / (M_PER_DEG_LON_EQ * Math.cos((g.lat * Math.PI) / 180)), g.lat - ((y - half) * g.cell) / M_PER_DEG_LAT];
}

/** Cell index containing a point, or -1 outside the grid. */
export function cellOf(g: GridGeo, lon: number, lat: number): number {
  const half = (g.n - 1) / 2;
  const x = Math.round(half + ((lon - g.lon) * M_PER_DEG_LON_EQ * Math.cos((g.lat * Math.PI) / 180)) / g.cell);
  const y = Math.round(half - ((lat - g.lat) * M_PER_DEG_LAT) / g.cell);
  return x < 0 || y < 0 || x >= g.n || y >= g.n ? -1 : y * g.n + x;
}

/** Outer corners [NW, NE, SE, SW] as [lon, lat] — for a MapLibre image source. */
export function gridCorners(g: GridGeo): [[number, number], [number, number], [number, number], [number, number]] {
  const nw = cellLonLat(g, -0.5, -0.5);
  const se = cellLonLat(g, g.n - 0.5, g.n - 0.5);
  return [nw, [se[0], nw[1]], se, [nw[0], se[1]]];
}

export interface Forecast {
  /** hours from the current hour onward */
  weather: HourWeather[];
  /** the 24 hours before, used only to spin up fuel moisture */
  spinUp: HourWeather[];
  model: string;
}

/** Hourly 10 m wind, gusts, temperature and humidity: past 24 h + up to 72 h ahead. */
export async function fetchForecast(lat: number, lon: number, signal?: AbortSignal): Promise<Forecast> {
  const q = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    wind_speed_unit: "kmh",
    timezone: "GMT",
    past_days: "1",
    forecast_days: "4",
  });
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, { signal });
  if (!r.ok) throw new Error(`Open-Meteo responded ${r.status}`);
  const j = (await r.json()) as {
    hourly: Record<"time" | "temperature_2m" | "relative_humidity_2m" | "wind_speed_10m" | "wind_direction_10m" | "wind_gusts_10m", (number | string | null)[]>;
  };
  const h = j.hourly;
  const all: HourWeather[] = h.time.map((t, i) => ({
    time: `${String(t)}:00Z`,
    tempC: Number(h.temperature_2m[i] ?? 20),
    rh: Number(h.relative_humidity_2m[i] ?? 50),
    windKmh: Number(h.wind_speed_10m[i] ?? 0),
    windFromDeg: Number(h.wind_direction_10m[i] ?? 0),
    gustKmh: Number(h.wind_gusts_10m[i] ?? 0),
  }));
  const nowHour = new Date().toISOString().slice(0, 13);
  let i0 = all.findIndex((w) => w.time.slice(0, 13) >= nowHour);
  if (i0 < 0) i0 = 0;
  return { weather: all.slice(i0, i0 + 72), spinUp: all.slice(Math.max(0, i0 - 24), i0), model: "Open-Meteo best match" };
}

// --- terrain -----------------------------------------------------------------------------------

const TILE = 256;
const tileUrl = (z: number, x: number, y: number) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

const lonToX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z * TILE;
const latToY = (lat: number, z: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z * TILE;
};

async function loadTile(z: number, x: number, y: number, signal?: AbortSignal): Promise<ImageData> {
  const r = await fetch(tileUrl(z, x, y), { signal });
  if (!r.ok) throw new Error(`terrain tile ${z}/${x}/${y}: ${r.status}`);
  const bmp = await createImageBitmap(await r.blob());
  const c = new OffscreenCanvas(TILE, TILE);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0);
  return ctx.getImageData(0, 0, TILE, TILE);
}

/**
 * Elevation (m) at every cell centre, bilinear from Terrarium tiles at a zoom whose pixel is
 * no coarser than the cell. Terrarium: h = R·256 + G + B/256 − 32768.
 */
export async function fetchElevation(g: GridGeo, signal?: AbortSignal): Promise<Float32Array> {
  const mpp0 = 156_543.03 * Math.cos((g.lat * Math.PI) / 180);
  const z = Math.min(13, Math.max(8, Math.ceil(Math.log2(mpp0 / g.cell))));
  const [w, n] = cellLonLat(g, -1, -1);
  const [e, s] = cellLonLat(g, g.n, g.n);
  const tx0 = Math.floor(lonToX(w, z) / TILE), tx1 = Math.floor(lonToX(e, z) / TILE);
  const ty0 = Math.floor(latToY(n, z) / TILE), ty1 = Math.floor(latToY(s, z) / TILE);
  if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 36) throw new Error("Area too large for the terrain data");
  const tiles = new Map<string, ImageData>();
  await Promise.all(
    Array.from({ length: tx1 - tx0 + 1 }, (_, i) => tx0 + i).flatMap((tx) =>
      Array.from({ length: ty1 - ty0 + 1 }, (_, j) => ty0 + j).map(async (ty) => tiles.set(`${tx}/${ty}`, await loadTile(z, tx, ty, signal))),
    ),
  );
  const px = (X: number, Y: number): number => {
    const tx = Math.floor(X / TILE), ty = Math.floor(Y / TILE);
    const t = tiles.get(`${tx}/${ty}`);
    if (!t) return 0;
    const o = ((Y - ty * TILE) * TILE + (X - tx * TILE)) * 4;
    return t.data[o]! * 256 + t.data[o + 1]! + t.data[o + 2]! / 256 - 32768;
  };
  const out = new Float32Array(g.n * g.n);
  for (let y = 0; y < g.n; y++)
    for (let x = 0; x < g.n; x++) {
      const [lon, lat] = cellLonLat(g, x, y);
      const X = lonToX(lon, z) - 0.5, Y = latToY(lat, z) - 0.5;
      const x0 = Math.floor(X), y0 = Math.floor(Y), fx = X - x0, fy = Y - y0;
      out[y * g.n + x] =
        px(x0, y0) * (1 - fx) * (1 - fy) + px(x0 + 1, y0) * fx * (1 - fy) + px(x0, y0 + 1) * (1 - fx) * fy + px(x0 + 1, y0 + 1) * fx * fy;
    }
  return out;
}
