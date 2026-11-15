import type { Source } from "./types";

export type Level = 0 | 1 | 2 | 3 | 4;

/**
 * 5 colour steps from quantiles of log10(value+1). Fire counts span orders of magnitude,
 * a linear scale would only show peak months. Zero always maps to level 0.
 */
export function colourSteps(values: number[]): (v: number) => Level {
  const lv = values.filter((v) => v > 0).map((v) => Math.log10(v + 1)).sort((a, b) => a - b);
  const q = (p: number) => lv[Math.floor(p * (lv.length - 1))] ?? 0;
  const cuts = [q(0.2), q(0.45), q(0.7), q(0.9)];
  return (v) => {
    if (!(v > 0)) return 0;
    const x = Math.log10(v + 1);
    return Math.max(1, cuts.filter((c) => x > c).length) as Level;
  };
}

export const SOURCE_LABEL_TH: Record<Source, string> = {
  observed: "Measured by VIIRS",
  backcast: "Converted from MODIS",
  backcast_terra: "Converted from Terra (less accurate)",
};

export const LEVEL_LABEL_TH = ["No fire", "Low", "Moderate", "High", "Very high"] as const;

/** Thousands separator, no decimals, "~" prefix for computed values. */
export function fmtCount(v: number, computed = false): string {
  return `${computed ? "~" : ""}${Math.round(v).toLocaleString("en-US")}`;
}
