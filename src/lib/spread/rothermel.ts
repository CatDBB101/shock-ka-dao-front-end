// Rothermel (1972) surface fire spread with the Albini (1976) formulation used by BehavePlus,
// FARSITE and FlamMap (equations as written in Andrews 2018, USDA FS RMRS-GTR-371).
// Internally US customary units (lb, ft, Btu, min) like the original paper; the public API is SI.
// Pure functions, no DOM — unit-tested in spread.test.ts.

export interface FuelModel {
  id: string;
  name: string;
  /** dead 1-h, 10-h, 100-h and live herbaceous/woody loads, ton/acre */
  load: [number, number, number, number];
  /** surface-area-to-volume of the 1-h class, 1/ft (10-h = 109, 100-h = 30, live = 1500) */
  sav1: number;
  /** fuel bed depth, ft */
  depth: number;
  /** dead fuel moisture of extinction, % */
  mxDead: number;
  /** fuels usually under a forest canopy → lower wind adjustment factor */
  sheltered: boolean;
}

/** Anderson (1982) 13 standard fuel models. */
export const FUEL_MODELS: readonly FuelModel[] = [
  { id: "1", name: "Short grass (dry grassland, savanna)", load: [0.74, 0, 0, 0], sav1: 3500, depth: 1.0, mxDead: 12, sheltered: false },
  { id: "2", name: "Grass under open timber", load: [2.0, 1.0, 0.5, 0.5], sav1: 3000, depth: 1.0, mxDead: 15, sheltered: false },
  { id: "3", name: "Tall grass (pampas, tall savanna)", load: [3.01, 0, 0, 0], sav1: 1500, depth: 2.5, mxDead: 25, sheltered: false },
  { id: "4", name: "Dense shrub (chaparral)", load: [5.01, 4.01, 2.0, 5.01], sav1: 2000, depth: 6.0, mxDead: 20, sheltered: false },
  { id: "5", name: "Low brush", load: [1.0, 0.5, 0, 2.0], sav1: 2000, depth: 2.0, mxDead: 20, sheltered: false },
  { id: "6", name: "Dormant brush", load: [1.5, 2.5, 2.0, 0], sav1: 1750, depth: 2.5, mxDead: 25, sheltered: false },
  { id: "7", name: "Southern rough (pine understory)", load: [1.13, 1.87, 1.5, 0.37], sav1: 1750, depth: 2.5, mxDead: 40, sheltered: false },
  { id: "8", name: "Closed timber litter", load: [1.5, 1.0, 2.5, 0], sav1: 2000, depth: 0.2, mxDead: 30, sheltered: true },
  { id: "9", name: "Hardwood / long-needle pine litter", load: [2.92, 0.41, 0.15, 0], sav1: 2500, depth: 0.2, mxDead: 25, sheltered: true },
  { id: "10", name: "Timber litter with understory (boreal)", load: [3.01, 2.0, 5.01, 2.0], sav1: 2000, depth: 1.0, mxDead: 25, sheltered: true },
  { id: "11", name: "Light logging slash", load: [1.5, 4.51, 5.51, 0], sav1: 1500, depth: 1.0, mxDead: 15, sheltered: false },
  { id: "12", name: "Medium logging slash", load: [4.01, 14.03, 16.53, 0], sav1: 1500, depth: 2.3, mxDead: 20, sheltered: false },
  { id: "13", name: "Heavy logging slash", load: [7.01, 23.04, 28.05, 0], sav1: 1500, depth: 3.0, mxDead: 25, sheltered: false },
];

export const fuelById = (id: string): FuelModel => FUEL_MODELS.find((f) => f.id === id) ?? FUEL_MODELS[0]!;

/** Fuel moisture as fractions (0.06 = 6 %). */
export interface Moisture {
  d1: number;
  d10: number;
  d100: number;
  live: number;
}

const TPA_TO_LBFT2 = 0.0459137; // ton/acre → lb/ft²
const RHO_P = 32; // particle density, lb/ft³
const S_T = 0.0555; // total mineral content
const S_E = 0.01; // effective mineral content
const HEAT = 8000; // heat content, Btu/lb
const FT_TO_M = 0.3048;

interface Particle {
  w: number; // oven-dry load lb/ft²
  s: number; // SAV 1/ft
  m: number; // moisture fraction
}

/** Fuel-bed constants that don't depend on weather or slope. */
interface Bed {
  sigma: number;
  beta: number;
  betaRatio: number;
  rhoB: number;
  /** wind coefficient C, exponents B, E (φw = C·U^B·(β/βop)^−E) */
  C: number;
  B: number;
  E: number;
  xi: number;
}

/** Result of the no-wind/no-slope spread computation plus what wind/slope need. */
export interface SpreadBase {
  /** spread rate with no wind and no slope, m/min */
  r0: number;
  /** reaction intensity, kW/m² */
  ir: number;
  /** wind factor as a function of midflame wind (m/min) */
  phiW: (uMidflameMpm: number) => number;
  /** slope factor for tan(slope) */
  phiS: (tanSlope: number) => number;
  /** inverse of phiW: effective midflame wind (m/min) that gives wind factor φ */
  effectiveWind: (phi: number) => number;
  /** original Rothermel wind limit 0.9·IR (ft/min) expressed as midflame m/min; reported only, not applied */
  windLimit: number;
  /** flaming residence time, min (Anderson 1969: 384/σ) */
  residenceMin: number;
}

function particles(f: FuelModel, m: Moisture): { dead: Particle[]; live: Particle[] } {
  const [l1, l10, l100, lLive] = f.load.map((t) => t * TPA_TO_LBFT2) as [number, number, number, number];
  return {
    dead: [
      { w: l1, s: f.sav1, m: m.d1 },
      { w: l10, s: 109, m: m.d10 },
      { w: l100, s: 30, m: m.d100 },
    ].filter((p) => p.w > 0),
    live: lLive > 0 ? [{ w: lLive, s: 1500, m: m.live }] : [],
  };
}

const area = (p: Particle) => (p.s * p.w) / RHO_P;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function bed(f: FuelModel, dead: Particle[], live: Particle[]): Bed {
  const all = [...dead, ...live];
  const aD = sum(dead.map(area));
  const aL = sum(live.map(area));
  const aT = aD + aL;
  const sigCat = (ps: Particle[], a: number) => (a > 0 ? sum(ps.map((p) => (area(p) / a) * p.s)) : 0);
  const sigma = (aD / aT) * sigCat(dead, aD) + (aL / aT) * sigCat(live, aL);
  const rhoB = sum(all.map((p) => p.w)) / f.depth;
  const beta = rhoB / RHO_P;
  const betaOp = 3.348 * sigma ** -0.8189;
  const betaRatio = beta / betaOp;
  const xi = Math.exp((0.792 + 0.681 * Math.sqrt(sigma)) * (beta + 0.1)) / (192 + 0.2595 * sigma);
  return {
    sigma,
    beta,
    betaRatio,
    rhoB,
    C: 7.47 * Math.exp(-0.133 * sigma ** 0.55),
    B: 0.02526 * sigma ** 0.54,
    E: 0.715 * Math.exp(-3.59e-4 * sigma),
    xi,
  };
}

const etaM = (mf: number, mx: number) => {
  const r = Math.min(1, mx > 0 ? mf / mx : 1);
  return Math.max(0, 1 - 2.59 * r + 5.11 * r * r - 3.52 * r * r * r);
};

/** Rothermel spread for one fuel model and moisture state, before wind and slope. */
export function rothermelBase(f: FuelModel, m: Moisture): SpreadBase {
  const { dead, live } = particles(f, m);
  const b = bed(f, dead, live);
  const aD = sum(dead.map(area));
  const aL = sum(live.map(area));
  const aT = aD + aL;

  // weighting within each category (Rothermel f_ij) and net loads
  const fIn = (ps: Particle[], a: number) => ps.map((p) => (a > 0 ? area(p) / a : 0));
  const fD = fIn(dead, aD);
  const fL = fIn(live, aL);
  const wnD = sum(dead.map((p, i) => fD[i]! * p.w * (1 - S_T)));
  const wnL = sum(live.map((p, i) => fL[i]! * p.w * (1 - S_T)));
  const mfD = sum(dead.map((p, i) => fD[i]! * p.m));
  const mfL = sum(live.map((p, i) => fL[i]! * p.m));

  // live fuel moisture of extinction (Albini 1976)
  const mxD = f.mxDead / 100;
  let mxL = mxD;
  if (live.length) {
    const wPrime = sum(dead.map((p) => p.w * Math.exp(-138 / p.s))) / sum(live.map((p) => p.w * Math.exp(-500 / p.s)));
    const fineDeadM = sum(dead.map((p) => p.w * Math.exp(-138 / p.s) * p.m)) / sum(dead.map((p) => p.w * Math.exp(-138 / p.s)));
    mxL = Math.max(mxD, 2.9 * wPrime * (1 - fineDeadM / mxD) - 0.226);
  }

  const sig15 = b.sigma ** 1.5;
  const gMax = sig15 / (495 + 0.0594 * sig15);
  const A = 133 * b.sigma ** -0.7913;
  const gamma = gMax * b.betaRatio ** A * Math.exp(A * (1 - b.betaRatio));
  const etaS = Math.min(1, 0.174 * S_E ** -0.19);
  const ir = gamma * HEAT * etaS * (wnD * etaM(mfD, mxD) + wnL * etaM(mfL, mxL)); // Btu/ft²/min

  // heat sink: ρb · Σ f_i Σ f_ij exp(−138/σ) (250 + 1116 M)
  const sink = (ps: Particle[], fs: number[]) => sum(ps.map((p, i) => fs[i]! * Math.exp(-138 / p.s) * (250 + 1116 * p.m)));
  const heatSink = b.rhoB * ((aD / aT) * sink(dead, fD) + (aL / aT) * sink(live, fL));
  const r0ft = heatSink > 0 ? (ir * b.xi) / heatSink : 0; // ft/min

  const ftpm = (mpm: number) => mpm / FT_TO_M;
  return {
    r0: r0ft * FT_TO_M,
    ir: ir * 0.18928, // Btu/ft²/min → kW/m²
    phiW: (u) => (u > 0 ? b.C * ftpm(u) ** b.B * b.betaRatio ** -b.E : 0),
    phiS: (tan) => 5.275 * b.beta ** -0.3 * tan * tan,
    effectiveWind: (phi) => (phi > 0 ? (phi / (b.C * b.betaRatio ** -b.E)) ** (1 / b.B) * FT_TO_M : 0),
    windLimit: 0.9 * ir * FT_TO_M,
    residenceMin: 384 / b.sigma,
  };
}

/**
 * Wind adjustment factor, 10 m open wind → midflame (Albini & Baughman 1979, as in BehavePlus).
 * Unsheltered: 1.83 / ln((20 + 0.36 H) / (0.13 H)), H = fuel depth ft, relative to 20-ft wind;
 * 10 m wind ≈ 1.15 × 20-ft wind. Sheltered fuels under a moderate canopy use 0.15.
 */
export function windAdjustment(f: FuelModel): number {
  if (f.sheltered) return 0.15;
  const h = f.depth;
  return 1.83 / Math.log((20 + 0.36 * h) / (0.13 * h)) / 1.15;
}

/** Fire spread at one point: head direction, head rate and ellipse shape. */
export interface PointSpread {
  /** head fire rate of spread, m/min */
  rMax: number;
  /** azimuth the head fire moves toward, degrees clockwise from north */
  headDeg: number;
  /** ellipse eccentricity (0 = circle) */
  ecc: number;
  /** length-to-breadth ratio */
  lb: number;
  /** effective midflame wind speed, m/min */
  uEff: number;
  /** Byram fireline intensity at the head, kW/m */
  intensity: number;
}

/**
 * Combine wind and slope as vectors (Rothermel 1983 / BehavePlus "direction of max spread").
 * windFromDeg: meteorological direction the wind blows FROM. upslopeDeg: azimuth pointing uphill.
 */
export function pointSpread(base: SpreadBase, uMidflameMpm: number, windFromDeg: number, tanSlope: number, upslopeDeg: number): PointSpread {
  const u = Math.max(0, uMidflameMpm);
  const pw = base.phiW(u);
  const ps = tanSlope > 0 ? base.phiS(tanSlope) : 0;
  const windTo = (windFromDeg + 180) % 360;
  const rad = Math.PI / 180;
  // vector sum in (east, north)
  const x = pw * Math.sin(windTo * rad) + ps * Math.sin(upslopeDeg * rad);
  const y = pw * Math.cos(windTo * rad) + ps * Math.cos(upslopeDeg * rad);
  const phiE = Math.hypot(x, y);
  const headDeg = phiE > 0 ? ((Math.atan2(x, y) / rad) + 360) % 360 : windTo;
  const uEff = base.effectiveWind(phiE);
  // Andrews, Cruz & Rothermel (2013): instead of the old 0.9·IR wind limit, cap the head-fire
  // rate at the effective midflame wind speed (R ≤ U) when wind drives the fire.
  const rRaw = base.r0 * (1 + phiE);
  const rMax = uEff > 0 && rRaw > uEff && rRaw > base.r0 ? Math.max(base.r0, uEff) : rRaw;
  // Anderson (1983) length-to-breadth with midflame wind in mph, capped at 8 like FARSITE
  const mph = uEff / 26.8224;
  const lb = Math.min(8, Math.max(1, 0.936 * Math.exp(0.2566 * mph) + 0.461 * Math.exp(-0.1548 * mph) - 0.397));
  const ecc = Math.sqrt(lb * lb - 1) / lb;
  // Byram intensity I = IR × flame depth, flame depth = R × t_r (Anderson 1969 residence time t_r = 384/σ min)
  const intensity = base.ir * rMax * base.residenceMin; // kW/m² × m/min × min = kW/m
  return { rMax, headDeg, ecc, lb, uEff, intensity };
}

/** Spread rate in a direction `azDeg` from an ignition point (elliptical fire, BehavePlus). */
export function rosAt(p: PointSpread, azDeg: number): number {
  const psi = ((azDeg - p.headDeg) * Math.PI) / 180;
  return (p.rMax * (1 - p.ecc)) / (1 - p.ecc * Math.cos(psi));
}

/** Flame length from Byram intensity (Byram 1959): L = 0.0775 · I^0.46, I in kW/m, L in m. */
export const flameLength = (intensityKwM: number): number => 0.0775 * Math.max(0, intensityKwM) ** 0.46;
