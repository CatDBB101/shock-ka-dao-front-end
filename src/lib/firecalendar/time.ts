import type { AoiRow, Source, YearMonth } from "./types";
import { FIRST_YM, LAST_YM } from "./config";

export const MONTHS_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."] as const;
export const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export const monthTh = (m: number): string => MONTHS_TH[(m - 1 + 12) % 12] ?? "";
export const monthEn = (m: number): string => MONTHS_EN[(m - 1 + 12) % 12] ?? "";

/** t = year*12 + month (same index as the backend SQL) */
export const tIndex = (year: number, month: number): number => year * 12 + month;

export function parseYm(ym: YearMonth): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(ym);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export const ymOf = (year: number, month: number): YearMonth => `${year}-${String(month).padStart(2, "0")}`;

export function ymToT(ym: YearMonth): number {
  const p = parseYm(ym);
  if (!p) throw new Error(`bad YYYY-MM: ${ym}`);
  return tIndex(p.year, p.month);
}

/** Which instrument a month comes from (used when filling missing AOI months). */
export function sourceFor(year: number, month: number): Source {
  const t = tIndex(year, month);
  if (t < tIndex(2002, 7)) return "backcast_terra";
  if (t < tIndex(2012, 2)) return "backcast";
  return "observed";
}

/**
 * AOI rows are sparse: months with no fire have no row. Build the full range and fill zeros.
 * Sparse AOI data — always pass through this function before displaying.
 */
export function fillMonths(rows: AoiRow[], start: YearMonth = FIRST_YM, end: YearMonth = LAST_YM): AoiRow[] {
  const byT = new Map(rows.map((r) => [tIndex(r.year, r.month), r]));
  // clim_median is per calendar month (same for every year) → reuse it for zero-filled months
  const climByMonth = new Map<number, number>();
  for (const r of rows) if (r.clim_median != null) climByMonth.set(r.month, r.clim_median);
  const out: AoiRow[] = [];
  for (let t = ymToT(start); t <= ymToT(end); t++) {
    const year = Math.floor((t - 1) / 12);
    const month = t - year * 12;
    out.push(
      byT.get(t) ?? {
        year,
        month,
        source: sourceFor(year, month),
        value: 0,
        modis: 0,
        viirs_model: 0,
        p_lo: 0,
        p_hi: 0,
        clim_median: climByMonth.get(month) ?? null,
        pct_vs_ref: null,
      },
    );
  }
  return out;
}

export function daysBetween(startDate: string, endDate: string): number {
  const a = Date.parse(`${startDate}T00:00:00Z`);
  const b = Date.parse(`${endDate}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
