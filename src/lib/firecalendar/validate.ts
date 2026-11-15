import type { Box, YearMonth } from "./types";
import { FireCalendarError } from "./errors";
import { parseYm, tIndex, daysBetween } from "./time";
import { MAX_HOTSPOT_DAYS } from "./config";

const bad = (msg: string) => new FireCalendarError("validation", msg, 400);

/** Same rules as the API (400/422) so all three sources reject the same input. */
export function validateBox(b: Box): void {
  const vals = [b.minLat, b.minLon, b.maxLat, b.maxLon];
  if (vals.some((n) => typeof n !== "number" || !Number.isFinite(n))) throw bad("Enter all four coordinates as numbers");
  if (b.minLat < -90 || b.maxLat > 90) throw bad("Latitude must be between −90 and 90");
  if (b.minLon < -180 || b.maxLon > 180) throw bad("Longitude must be between −180 and 180");
  if (b.minLat >= b.maxLat || b.minLon >= b.maxLon) throw bad("Minimum must be less than maximum (min < max)");
}

export function validateRange(start?: YearMonth, end?: YearMonth): void {
  const s = start ? parseYm(start) : null;
  const e = end ? parseYm(end) : null;
  if (start && !s) throw bad(`Start month must be YYYY-MM (got '${start}')`);
  if (end && !e) throw bad(`End month must be YYYY-MM (got '${end}')`);
  if (s && e && tIndex(s.year, s.month) > tIndex(e.year, e.month)) throw bad("Start month is after end month");
}

export function validateDays(startDate: string, endDate: string): void {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(startDate) || !re.test(endDate)) throw bad("Dates must be YYYY-MM-DD");
  const n = daysBetween(startDate, endDate);
  if (!(n >= 1 && n <= MAX_HOTSPOT_DAYS)) throw bad(`Choose 1–${MAX_HOTSPOT_DAYS} days, with the start on or before the end`);
}
