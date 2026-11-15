// Grid fire growth by minimum travel time (Finney 2002 idea, as in FlamMap): fire arrival time at
// each cell = shortest path over a 16-neighbour stencil, where the travel time of each segment uses
// the elliptical Rothermel spread rate (wind + slope) at both ends, with hourly forecast weather.
// Pure TS: runs in a Web Worker (spread.worker.ts) and in unit tests.

import type { HourMoisture, HourWeather } from "./moisture";
import { FUEL_MODELS, fuelById, pointSpread, rosAt, rothermelBase, windAdjustment, flameLength, type PointSpread, type SpreadBase } from "./rothermel";
import { canopyWaf, cbhOf, crownState, hasCanopy, type CrownState } from "./crown";

export const NON_BURNABLE = 255;

export interface Grid {
  nx: number;
  ny: number;
  /** cell size, m */
  cell: number;
  /** row-major, row 0 = north edge; metres. null = flat */
  elev: Float32Array | null;
  /** index into FUEL_MODELS per cell, NON_BURNABLE for water/rock */
  fuel: Uint8Array;
  /** canopy height (m, p90 of the CHM) per cell; NaN = unknown. Absent = no canopy data at all */
  canopyH?: Float32Array;
  /** canopy cover 0–1 per cell (same layout as canopyH) */
  canopyCover?: Float32Array;
}

export interface Perturbation {
  /** added to the wind direction, degrees */
  dWindDeg: number;
  /** multiplies wind speed */
  windScale: number;
  /** added to dead fuel moisture, fraction */
  dMoisture: number;
}

export interface SimInput {
  grid: Grid;
  /** cell indices where the fire is burning at t = 0 */
  ignitions: number[];
  /** hourly weather from t = 0 */
  weather: HourWeather[];
  moisture: HourMoisture[];
  /** live fuel moisture, fraction (e.g. 1.0 = 100 %) */
  liveMoisture: number;
  durationMin: number;
  perturb?: Perturbation;
  /** precomputed slopeAspect(grid); ensemble() passes it so members don't recompute it */
  terrain?: { tan: Float32Array; up: Float32Array };
}

export interface SimResult {
  /** arrival time, minutes after t = 0; Infinity = not reached */
  arrival: Float32Array;
  reachedEdge: boolean;
  burnedHa: number;
  /** per forecast hour, at the first ignition cell */
  hourly: { hour: number; headDeg: number; rMax: number; flameM: number; windKmh: number; windFromDeg: number; d1: number; crown: CrownState }[];
  /** fire type when each cell burned: 0 surface, 1 passive crown (torching), 2 active crown; null without canopy data */
  crown: Uint8Array | null;
}

type CellSpread = PointSpread & { crown: CrownState };

/** Horn (1981) slope: returns tan(slope) and upslope azimuth (deg from north) per cell. */
export function slopeAspect(g: Grid): { tan: Float32Array; up: Float32Array } {
  const n = g.nx * g.ny;
  const tan = new Float32Array(n);
  const up = new Float32Array(n);
  if (!g.elev) return { tan, up };
  const z = (x: number, y: number) => g.elev![Math.min(g.ny - 1, Math.max(0, y)) * g.nx + Math.min(g.nx - 1, Math.max(0, x))]!;
  for (let y = 0; y < g.ny; y++)
    for (let x = 0; x < g.nx; x++) {
      const dzdx = (z(x + 1, y - 1) + 2 * z(x + 1, y) + z(x + 1, y + 1) - z(x - 1, y - 1) - 2 * z(x - 1, y) - z(x - 1, y + 1)) / (8 * g.cell);
      // rows grow southward, so north-positive gradient flips the sign
      const dzdy = (z(x - 1, y - 1) + 2 * z(x, y - 1) + z(x + 1, y - 1) - z(x - 1, y + 1) - 2 * z(x, y + 1) - z(x + 1, y + 1)) / (8 * g.cell);
      const i = y * g.nx + x;
      tan[i] = Math.hypot(dzdx, dzdy);
      up[i] = ((Math.atan2(dzdx, dzdy) * 180) / Math.PI + 360) % 360;
    }
  return { tan, up };
}

// 16-neighbour stencil (8 + knight moves) reduces the diamond artefact of 8-neighbour paths
const STENCIL: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
  [2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2],
];
// azimuth of each step: dx east, dy = +1 row = south
const STEP_AZ = STENCIL.map(([dx, dy]) => ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360);
const STEP_LEN = STENCIL.map(([dx, dy]) => Math.hypot(dx, dy));

/** Minimal binary heap keyed by arrival time. */
class Heap {
  private k: number[] = [];
  private v: number[] = [];
  get size() {
    return this.k.length;
  }
  push(key: number, val: number) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p]! <= key) break;
      k[i] = k[p]!;
      v[i] = v[p]!;
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  pop(): [number, number] {
    const k = this.k, v = this.v;
    const top: [number, number] = [k[0]!, v[0]!];
    const lk = k.pop()!, lv = v.pop()!;
    if (k.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        let mk = lk;
        if (l < k.length && k[l]! < mk) {
          m = l;
          mk = k[l]!;
        }
        if (r < k.length && k[r]! < mk) m = r;
        if (m === i) break;
        k[i] = k[m]!;
        v[i] = v[m]!;
        i = m;
      }
      k[i] = lk;
      v[i] = lv;
    }
    return top;
  }
}

const KMH_TO_MPM = 1000 / 60;

export function simulate(inp: SimInput): SimResult {
  const { grid: g, weather, moisture } = inp;
  const p = inp.perturb ?? { dWindDeg: 0, windScale: 1, dMoisture: 0 };
  const n = g.nx * g.ny;
  const nh = Math.max(1, Math.min(weather.length, moisture.length));
  const { tan, up } = inp.terrain ?? slopeAspect(g);

  // Rothermel base per (fuel model, hour): weather and moisture are uniform over the domain
  const baseCache = new Map<number, SpreadBase>();
  const base = (f: number, h: number): SpreadBase => {
    const key = f * 1000 + h;
    let b = baseCache.get(key);
    if (!b) {
      const m = moisture[h]!;
      const dm = p.dMoisture;
      b = rothermelBase(FUEL_MODELS[f]!, { d1: Math.max(0.02, m.d1 + dm), d10: Math.max(0.02, m.d10 + dm), d100: Math.max(0.02, m.d100 + dm), live: inp.liveMoisture });
      baseCache.set(key, b);
    }
    return b;
  };
  // fuel model 10 per hour: Rothermel (1991) crown spread is 3.34 × its rate at 0.4 × 20-ft wind
  const fm10 = FUEL_MODELS.indexOf(fuelById("10"));
  const canopy = g.canopyH && g.canopyCover ? { h: g.canopyH, c: g.canopyCover } : null;
  // point spread per (cell, hour), with canopy sheltering and crown fire where the CHM says there is a canopy
  const psCache = new Map<number, CellSpread>();
  const spreadAt = (i: number, h: number): CellSpread => {
    const key = i * nh + h;
    let s = psCache.get(key);
    if (!s) {
      const f = g.fuel[i]!;
      const w = weather[h]!;
      const wind10 = w.windKmh * p.windScale * KMH_TO_MPM;
      const dir = (w.windFromDeg + p.dWindDeg + 360) % 360;
      const ch = canopy ? canopy.h[i]! : NaN;
      const cc = canopy ? canopy.c[i]! : 0;
      const waf = (canopy && canopyWaf(ch, cc)) ?? windAdjustment(FUEL_MODELS[f]!);
      const surf = pointSpread(base(f, h), wind10 * waf, dir, tan[i]!, up[i]!);
      let crown: CrownState = 0;
      let rMax = surf.rMax;
      if (canopy && hasCanopy(ch, cc)) {
        const rCrown = 3.34 * pointSpread(base(fm10, h), (wind10 / 1.15) * 0.4, dir, tan[i]!, up[i]!).rMax;
        crown = crownState(surf.intensity, rCrown, cbhOf(ch));
        if (crown === 2) rMax = Math.max(surf.rMax, rCrown);
      }
      s = { ...surf, rMax, crown };
      psCache.set(key, s);
    }
    return s;
  };
  const hourOf = (t: number) => Math.min(nh - 1, Math.floor(t / 60));

  const arrival = new Float64Array(n).fill(Infinity);
  const crownAt = canopy ? new Uint8Array(n) : null;
  const done = new Uint8Array(n);
  const heap = new Heap();
  for (const i of inp.ignitions)
    if (i >= 0 && i < n && g.fuel[i] !== NON_BURNABLE) {
      arrival[i] = 0;
      heap.push(0, i);
    }

  let reachedEdge = false;
  while (heap.size) {
    const [t, i] = heap.pop();
    if (done[i] || t > arrival[i]!) continue;
    done[i] = 1;
    const x = i % g.nx;
    const y = (i - x) / g.nx;
    if (x === 0 || y === 0 || x === g.nx - 1 || y === g.ny - 1) reachedEdge = true;
    const h = hourOf(t);
    const sa = spreadAt(i, h);
    if (crownAt) crownAt[i] = sa.crown;
    for (let k = 0; k < STENCIL.length; k++) {
      const [dx, dy] = STENCIL[k]!;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= g.nx || ny >= g.ny) continue;
      const j = ny * g.nx + nx;
      if (done[j] || g.fuel[j] === NON_BURNABLE) continue;
      // knight moves must not jump over a non-burnable cell
      if (k >= 8 && g.fuel[(y + Math.round(dy / 2)) * g.nx + (x + Math.round(dx / 2))] === NON_BURNABLE) continue;
      const az = STEP_AZ[k]!;
      const half = (STEP_LEN[k]! * g.cell) / 2;
      const ra = rosAt(sa, az);
      const rb = rosAt(spreadAt(j, h), az);
      if (ra < 1e-4 || rb < 1e-4) continue;
      const tj = t + half / ra + half / rb;
      if (tj <= inp.durationMin && tj < arrival[j]!) {
        arrival[j] = tj;
        heap.push(tj, j);
      }
    }
  }

  let burned = 0;
  for (let i = 0; i < n; i++) if (arrival[i]! <= inp.durationMin) burned++;
  // weather/fire summary at the first burnable ignition; none burnable (e.g. clicked on water) → no fire
  const i0 = inp.ignitions.find((i) => i >= 0 && i < n && g.fuel[i] !== NON_BURNABLE);
  const hourly = Array.from({ length: i0 === undefined ? 0 : Math.min(nh, Math.ceil(inp.durationMin / 60)) }, (_, h) => {
    const s = spreadAt(i0!, h);
    const w = weather[h]!;
    return {
      hour: h,
      headDeg: s.headDeg,
      rMax: s.rMax,
      flameM: flameLength(s.intensity),
      windKmh: w.windKmh * p.windScale,
      windFromDeg: (w.windFromDeg + p.dWindDeg + 360) % 360,
      d1: moisture[h]!.d1 + p.dMoisture,
      crown: s.crown,
    };
  });
  return { arrival: Float32Array.from(arrival), reachedEdge, burnedHa: (burned * g.cell * g.cell) / 10_000, hourly, crown: crownAt };
}

/** Deterministic PRNG (mulberry32) so an ensemble is reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box–Muller. */
function gauss(r: () => number): number {
  const u = Math.max(1e-12, r());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

/**
 * Forecast-error spread for the ensemble. Wind direction error dominates perimeter error in
 * forecast-driven runs (WRF-SFIRE real-time tests), so it gets the widest spread.
 */
export const ENSEMBLE_SPREAD = { windDirSdDeg: 20, windSpeedLogSd: 0.25, moistureSd: 0.01 } as const;

export function perturbations(members: number, seed = 1): Perturbation[] {
  const r = rng(seed);
  const out: Perturbation[] = [{ dWindDeg: 0, windScale: 1, dMoisture: 0 }]; // member 0 = deterministic forecast
  for (let k = 1; k < members; k++)
    out.push({
      dWindDeg: gauss(r) * ENSEMBLE_SPREAD.windDirSdDeg,
      windScale: Math.exp(gauss(r) * ENSEMBLE_SPREAD.windSpeedLogSd),
      dMoisture: gauss(r) * ENSEMBLE_SPREAD.moistureSd,
    });
  return out;
}

export interface EnsembleResult {
  /** member 0 = the unperturbed forecast */
  deterministic: SimResult;
  /** fraction of members that reached each cell within the duration, 0..1 */
  probability: Float32Array;
  members: number;
  reachedEdge: boolean;
  /** burned area percentiles across members, ha */
  burnedHa: { p10: number; p50: number; p90: number };
}

export function ensemble(inp: Omit<SimInput, "perturb">, members: number, seed = 1, onProgress?: (done: number) => void): EnsembleResult {
  const pert = perturbations(members, seed);
  const n = inp.grid.nx * inp.grid.ny;
  const count = new Uint16Array(n);
  const areas: number[] = [];
  let det: SimResult | null = null;
  let edge = false;
  const terrain = inp.terrain ?? slopeAspect(inp.grid);
  pert.forEach((pp, k) => {
    const r = simulate({ ...inp, terrain, perturb: pp });
    if (k === 0) det = r;
    edge ||= r.reachedEdge;
    areas.push(r.burnedHa);
    for (let i = 0; i < n; i++) if (r.arrival[i]! <= inp.durationMin) count[i]!++;
    onProgress?.(k + 1);
  });
  const probability = new Float32Array(n);
  for (let i = 0; i < n; i++) probability[i] = count[i]! / pert.length;
  areas.sort((a, b) => a - b);
  const q = (f: number) => areas[Math.min(areas.length - 1, Math.floor(f * (areas.length - 1) + 0.5))] ?? 0;
  return { deterministic: det!, probability, members: pert.length, reachedEdge: edge, burnedHa: { p10: q(0.1), p50: q(0.5), p90: q(0.9) } };
}
