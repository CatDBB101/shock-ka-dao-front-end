// Colours and scales shared by the 3D map and its legend (kept out of Sim3DMap so the page does not pull in maplibre eagerly).
import type { GridGeo } from "../../lib/spread/inputs";

/**
 * Flame columns are drawn taller than life so they read at map scale; the factor grows with the cell
 * size (a 5 m flame on a 277 m cell would be invisible at 1:1). The legend states the factor used.
 */
export const flameVertical = (cellM: number): number => Math.round(Math.max(25, cellM / 3));
/** burned-area colours by when the cell burned: early = deep red … late = pale amber (fixed bands) */
export const BURN_BANDS: [number, number, number][] = [
  [110, 12, 30],
  [170, 25, 30],
  [215, 60, 30],
  [240, 110, 40],
  [250, 160, 70],
  [253, 205, 120],
];
export const FLAME_STOPS: [number, string][] = [
  [0.3, "#ffe066"],
  [1.5, "#ff9f1c"],
  [3, "#f3501e"],
  [6, "#9d0b1f"],
];

/** Trees are exaggerated less than flames (they are everywhere; tall columns would hide the terrain). */
export const treeVertical = (cellM: number): number => Math.round(Math.max(3, cellM / 40));
/** displayed flame length multiplier on cells that burned as crown fire (passive, active); capped */
export const CROWN_FLAME = { passive: 1.5, active: 2.5, capM: 15 } as const;
export const TREE_COLOUR = { live: "#2f6b3a", burned: "#34302c" } as const;

export interface SimFrameRun {
  geo: GridGeo;
  arrival: Float32Array;
  durationMin: number;
  /** per forecast hour at the ignition: head rate (m/min) and head flame length (m) */
  hourly: { rMax: number; flameM: number }[];
  /** canopy height m / cover 0–1 per cell (CHM), when tiles covered the grid */
  canopy?: { height: Float32Array; cover: Float32Array } | null;
  /** 0 surface, 1 passive crown, 2 active crown per burned cell */
  crown?: Uint8Array | null;
}

