import type { Box, CalendarRow } from "./types";

/** bbox order in the URL = minLat,minLon,maxLat,maxLon */
export function readBoxFromUrl(sp: URLSearchParams): Box | null {
  const p = sp.get("bbox")?.split(",").map(Number);
  if (!p || p.length !== 4 || p.some((n) => !Number.isFinite(n))) return null;
  const [minLat, minLon, maxLat, maxLon] = p as [number, number, number, number];
  return { minLat, minLon, maxLat, maxLon };
}

export const boxToParam = (b: Box): string => [b.minLat, b.minLon, b.maxLat, b.maxLon].join(",");

export function calendarToCsv(rows: CalendarRow[]): string {
  const cols = ["region", "year", "month", "source", "value", "p_lo", "p_hi", "modis", "viirs_obs", "clim_median", "pct_vs_ref"] as const;
  // null/undefined → empty cell (Excel/pandas read it as missing, not the text "null")
  return [cols.join(","), ...rows.map((r) => cols.map((c) => (r[c] == null ? "" : String(r[c]))).join(","))].join("\n");
}

/** Download text as a file. UTF-8 BOM so Excel opens Thai/UTF-8 correctly. */
export function saveText(text: string, filename: string, mime = "text/csv"): void {
  const blob = new Blob(["﻿", text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
