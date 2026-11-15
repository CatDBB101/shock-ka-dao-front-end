// One spread run end to end (shared by /spread and /simulator): fetch forecast + terrain, build the
// grid (fuel, sea mask, firebreaks), spin up fuel moisture, run the ensemble in a Web Worker.
import { deadMoistureSeries, emcSimard, type HourWeather } from "./moisture";
import { cellLonLat, cellOf, fetchElevation, fetchForecast, type Forecast, type GridGeo } from "./inputs";
import { FUEL_MODELS, fuelById, pointSpread, rosAt, rothermelBase, windAdjustment } from "./rothermel";
import { NON_BURNABLE, type EnsembleResult, type Grid } from "./simulate";
import { fetchCanopy, type CanopyGrid } from "./canopy";
import type { WorkerRequest, WorkerResponse } from "./spread.worker";

export type LonLat = [number, number];

/** Fixed weather for "what if" runs instead of the forecast. */
export interface WeatherOverride {
  windKmh: number;
  windFromDeg: number;
  tempC: number;
  rh: number;
}

export interface RunParams {
  ignition: LonLat;
  /** grid centre; defaults to the ignition (suggestDomain shifts it downwind) */
  center?: LonLat;
  fuelId: string;
  durationH: number;
  /** grid cells per side */
  n: number;
  domainKm: number;
  members: number;
  /** live fuel moisture, fraction */
  liveMoisture: number;
  /** extra ignition points (satellite hotspots) */
  hotspots?: LonLat[];
  /** polylines the fire cannot cross (roads, dozer lines, rivers) */
  firebreaks?: LonLat[][];
  weather?: WeatherOverride | null;
  /** use the canopy height model where tiles exist (default true) */
  useCanopy?: boolean;
  seed?: number;
}

export interface RunOutput {
  geo: GridGeo;
  forecast: Forecast;
  result: EnsembleResult;
  /** elevation per cell, null when terrain could not be loaded (flat run) */
  elev: Float32Array | null;
  fuel: Uint8Array;
  /** canopy per cell when tiles covered the grid, else null */
  canopy: CanopyGrid | null;
  hotspotsUsed: number;
  durationH: number;
  weatherSource: "forecast" | "manual";
}

function constantWeather(w: WeatherOverride, hours: number): HourWeather[] {
  const t0 = Date.parse(`${new Date().toISOString().slice(0, 13)}:00:00Z`);
  return Array.from({ length: hours }, (_, i) => ({
    time: new Date(t0 + i * 3_600_000).toISOString().slice(0, 16) + "Z",
    tempC: w.tempC,
    rh: w.rh,
    windKmh: w.windKmh,
    windFromDeg: w.windFromDeg,
    gustKmh: w.windKmh,
  }));
}

/** Mark the cells under each polyline as non-burnable, two cells thick so no diagonal step slips through. */
export function burnFirebreaks(fuel: Uint8Array, geo: GridGeo, lines: LonLat[][]): number {
  let marked = 0;
  const mark = (i: number) => {
    if (i >= 0 && i < fuel.length && fuel[i] !== NON_BURNABLE) {
      fuel[i] = NON_BURNABLE;
      marked++;
    }
  };
  for (const line of lines)
    for (let k = 1; k < line.length; k++) {
      const [a, b] = [line[k - 1]!, line[k]!];
      // ≥ 2 samples per cell even for a segment spanning the whole diagonal (√2·n cells)
      const steps = geo.n * 4;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const i = cellOf(geo, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
        if (i < 0) continue;
        mark(i);
        if ((i + 1) % geo.n !== 0) mark(i + 1);
        mark(i + geo.n);
      }
    }
  return marked;
}

export async function runSpread(p: RunParams, onStatus: (msg: string) => void, signal?: AbortSignal): Promise<RunOutput> {
  const c = p.center ?? p.ignition;
  const geo: GridGeo = { lon: c[0], lat: c[1], n: p.n, cell: (p.domainKm * 1000) / p.n };
  onStatus(p.weather ? "Loading terrain…" : "Loading weather forecast and terrain…");
  const [fc, elev, canopy] = await Promise.all([
    p.weather ? null : fetchForecast(geo.lat, geo.lon, signal),
    fetchElevation(geo, signal).catch(() => null),
    p.useCanopy === false ? null : fetchCanopy(geo, signal).catch(() => null),
  ]);
  const hours = Math.max(1, Math.ceil(p.durationH));
  const forecast: Forecast = p.weather
    ? { weather: constantWeather(p.weather, hours), spinUp: constantWeather(p.weather, 24), model: "manual" }
    : fc!;
  if (forecast.weather.length < Math.min(hours, 6)) throw new Error("The weather forecast is too short. Try again later");

  const fIdx = Math.max(0, FUEL_MODELS.findIndex((f) => f.id === p.fuelId));
  const fuel = new Uint8Array(p.n * p.n).fill(fIdx);
  // Terrarium has sea-floor depths, no water mask. Treat cells below −2 m as sea, unless the
  // ignition itself is below that (a dry depression such as Death Valley or Laguna del Carbón).
  const c0 = cellOf(geo, p.ignition[0], p.ignition[1]);
  const ignitionBelowSea = elev != null && c0 >= 0 && elev[c0]! < -2;
  if (elev && !ignitionBelowSea) for (let i = 0; i < fuel.length; i++) if (elev[i]! < -2) fuel[i] = NON_BURNABLE;
  if (p.firebreaks?.length) burnFirebreaks(fuel, geo, p.firebreaks);
  const grid: Grid = { nx: p.n, ny: p.n, cell: geo.cell, elev, fuel, ...(canopy ? { canopyH: canopy.height, canopyCover: canopy.cover } : {}) };

  const ign = new Set<number>();
  if (c0 >= 0) ign.add(c0);
  for (const [lon, lat] of p.hotspots ?? []) {
    const i = cellOf(geo, lon, lat);
    if (i >= 0) ign.add(i);
  }
  if (![...ign].some((i) => fuel[i] !== NON_BURNABLE)) throw new Error("The ignition is on water or on a firebreak. Pick another point");

  const moisture = deadMoistureSeries([...forecast.spinUp, ...forecast.weather]).slice(forecast.spinUp.length);
  const req: WorkerRequest = {
    input: { grid, ignitions: [...ign], weather: forecast.weather, moisture, liveMoisture: p.liveMoisture, durationMin: p.durationH * 60 },
    members: p.members,
    seed: p.seed ?? 20261115,
  };
  onStatus(`Simulating 0/${p.members}…`);
  const w = new Worker(new URL("./spread.worker.ts", import.meta.url), { type: "module" });
  try {
    const result = await new Promise<EnsembleResult>((resolve, reject) => {
      signal?.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")));
      w.onmessage = (ev: MessageEvent<WorkerResponse>) => {
        const m = ev.data;
        if (m.type === "progress") onStatus(`Simulating ${m.done}/${p.members}…`);
        else if (m.type === "done") resolve(m.result);
        else reject(new Error(m.message));
      };
      w.onerror = (e) => reject(new Error(e.message || "worker error"));
      w.postMessage(req);
    });
    return { geo, forecast, result, elev, fuel, canopy, hotspotsUsed: ign.size - (c0 >= 0 ? 1 : 0), durationH: p.durationH, weatherSource: p.weather ? "manual" : "forecast" };
  } finally {
    w.terminate();
  }
}

/**
 * Domain sized to the expected fire (manual weather is known up front): flat-ground Rothermel head and
 * backing distances over the run, ×1.25 margin, centred between them so the downwind side gets the room.
 */
export function suggestDomain(fuelId: string, w: WeatherOverride, durationH: number, ignition: LonLat): { center: LonLat; domainKm: number } {
  const f = fuelById(fuelId);
  const emc = emcSimard(w.tempC, w.rh) / 100;
  const base = rothermelBase(f, { d1: emc, d10: emc + 0.01, d100: emc + 0.02, live: 0.9 });
  const ps = pointSpread(base, ((w.windKmh * 1000) / 60) * windAdjustment(f), w.windFromDeg, 0, 0);
  const minutes = durationH * 60;
  const head = ps.rMax * minutes;
  const back = rosAt(ps, ps.headDeg + 180) * minutes;
  const domainKm = Math.min(80, Math.max(4, ((head + back) * 1.25) / 1000 + 2));
  const shiftM = (head - back) / 2;
  const rad = (ps.headDeg * Math.PI) / 180;
  const center: LonLat = [
    ignition[0] + (shiftM * Math.sin(rad)) / (111_320 * Math.cos((ignition[1] * Math.PI) / 180)),
    ignition[1] + (shiftM * Math.cos(rad)) / 110_540,
  ];
  return { center, domainKm: Math.round(domainKm * 10) / 10 };
}

/** Square ring of one grid cell as [lon, lat] — for extruded flame columns. */
export function cellRing(geo: GridGeo, i: number): LonLat[] {
  const x = i % geo.n;
  const y = Math.floor(i / geo.n);
  const a = cellLonLat(geo, x - 0.5, y - 0.5);
  const b = cellLonLat(geo, x + 0.5, y + 0.5);
  return [a, [b[0], a[1]], b, [a[0], b[1]], a];
}
