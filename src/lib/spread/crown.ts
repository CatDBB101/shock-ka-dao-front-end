// Canopy effects on fire behaviour, from a canopy height model (CHM) + canopy cover.
//   1. Wind under the canopy: Albini & Baughman (1979) sheltered wind adjustment factor (as in BehavePlus).
//   2. Crown fire initiation: Van Wagner (1977) critical surface intensity.
//   3. Active crown fire: Van Wagner (1977) criterion R ≥ 3.0 / CBD, crown spread rate from
//      Rothermel (1991): R_crown = 3.34 × R(fuel model 10, midflame wind = 0.4 × 20-ft wind).
// The CHM gives canopy height and cover only. Canopy base height and bulk density are NOT measured;
// the defaults below are stated assumptions (shown in the UI), typical of conifer/eucalypt stands.

export const CANOPY_DEFAULTS = {
  /** canopy base height as a fraction of canopy height */
  cbhRatio: 0.3,
  /** canopy bulk density, kg/m³ */
  cbd: 0.1,
  /** foliar moisture content, % */
  foliarMoisture: 100,
  /** crown ratio (crown length / tree height), for the crown fill fraction */
  crownRatio: 0.5,
  /** below this cover or height a cell is treated as open (no canopy effects) */
  minCover: 0.25,
  minHeightM: 3,
} as const;

const M_TO_FT = 3.28084;

/**
 * Sheltered wind adjustment factor relative to the 10 m open wind.
 * BehavePlus: f = cover × crownRatio / 3 (crown fill); WAF₂₀ = 0.555 / (√(f·H) · ln((20 + 0.36H) / (0.13H))), H in ft.
 * Returns null when the canopy is too sparse/short to shelter the fuel (use the unsheltered WAF).
 */
export function canopyWaf(heightM: number, cover: number, crownRatio: number = CANOPY_DEFAULTS.crownRatio): number | null {
  if (!(heightM >= CANOPY_DEFAULTS.minHeightM) || !(cover >= 0.05)) return null;
  const f = (cover * crownRatio) / 3;
  if (f < 0.05) return null;
  const h = heightM * M_TO_FT;
  const waf20 = 0.555 / (Math.sqrt(f * h) * Math.log((20 + 0.36 * h) / (0.13 * h)));
  return Math.min(0.6, Math.max(0.05, waf20 / 1.15));
}

/** Van Wagner (1977): surface fireline intensity (kW/m) needed to ignite the crowns. CBH m, FMC %. */
export const crownInitiationIntensity = (cbhM: number, fmc: number = CANOPY_DEFAULTS.foliarMoisture): number =>
  (0.01 * Math.max(0.1, cbhM) * (460 + 25.9 * fmc)) ** 1.5;

/** 0 = surface fire, 1 = passive crown fire (torching), 2 = active crown fire. */
export type CrownState = 0 | 1 | 2;

export function crownState(surfaceIntensity: number, crownRos: number, cbhM: number, cbd: number = CANOPY_DEFAULTS.cbd): CrownState {
  if (surfaceIntensity < crownInitiationIntensity(cbhM)) return 0;
  return crownRos >= 3.0 / cbd ? 2 : 1;
}

/** Does this cell have a canopy that matters for fire behaviour? */
export const hasCanopy = (heightM: number, cover: number): boolean =>
  Number.isFinite(heightM) && heightM >= CANOPY_DEFAULTS.minHeightM && cover >= CANOPY_DEFAULTS.minCover;

export const cbhOf = (heightM: number): number => Math.max(1, heightM * CANOPY_DEFAULTS.cbhRatio);
