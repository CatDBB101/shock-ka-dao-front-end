// Firefighter watchpoint status — pure functions, no React, unit-tested.
// Two transparent signals (no "probability of fire" wording — research decision R5/6):
//   1. active  = VIIRS near-real-time hotspots inside the watch radius in the last ACTIVE_HOURS
//   2. season  = where this calendar month sits in the region's fire season (calendar_region.json)
import type { Season } from "../firecalendar/types";
import { haversineKm } from "../firecalendar/geo";
import { keepVegetationFires } from "../firecalendar/firms";
import type { Watchpoint } from "./types";

export const ACTIVE_HOURS = 48;
/** FIRMS NRT: NOAA-20 + NOAA-21 (S-NPP stopped sending in 2026, see project notes) */
export const NRT_SOURCES = ["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"] as const;

export type WatchLevel = "active" | "high" | "elevated" | "normal";
export const LEVEL_ORDER: Record<WatchLevel, number> = { active: 3, high: 2, elevated: 1, normal: 0 };
export const LEVEL_TH: Record<WatchLevel, string> = {
  active: "Hotspot detected",
  high: "High alert",
  elevated: "Watch",
  normal: "Normal",
};

export interface Hotspot {
  lat: number;
  lon: number;
  /** ISO UTC, e.g. 2026-11-14T03:25:00Z */
  time: string;
  frp: number;
  confidence: string;
  satellite: string;
}

/** FIRMS area CSV → hotspots. Skips the header, blank and "# missing" lines; tolerant of column order. */
export function parseFirmsCsv(raw: string): Hotspot[] {
  const csv = keepVegetationFires(raw).csv; // SP files: drop volcano / static sources (type != 0); NRT has no type
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  const head = lines[0]?.split(",").map((s) => s.trim());
  if (!head || !head.includes("latitude")) return [];
  const ix = (k: string) => head.indexOf(k);
  const [iLat, iLon, iDate, iTime, iFrp, iConf, iSat] = ["latitude", "longitude", "acq_date", "acq_time", "frp", "confidence", "satellite"].map(ix) as [
    number, number, number, number, number, number, number,
  ];
  const out: Hotspot[] = [];
  for (const line of lines.slice(1)) {
    const c = line.split(",");
    const lat = Number(c[iLat]);
    const lon = Number(c[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const hhmm = String(c[iTime] ?? "0").padStart(4, "0");
    out.push({
      lat,
      lon,
      time: `${c[iDate] ?? ""}T${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}:00Z`,
      frp: Number(c[iFrp]) || 0,
      confidence: iConf >= 0 ? String(c[iConf] ?? "") : "",
      satellite: iSat >= 0 ? String(c[iSat] ?? "") : "",
    });
  }
  return out;
}

/** Hotspots inside the watch circle, within the last `hours` before `now`; VIIRS low-confidence ("l") dropped like the pipeline. */
export function hotspotsNear(all: Hotspot[], wp: Pick<Watchpoint, "lat" | "lon" | "radiusKm">, now: Date, hours = ACTIVE_HOURS): Hotspot[] {
  const since = now.getTime() - hours * 3_600_000;
  return all.filter((h) => {
    if (h.confidence === "l") return false;
    const t = Date.parse(h.time);
    if (!(t >= since && t <= now.getTime() + 3_600_000)) return false;
    return haversineKm([wp.lon, wp.lat], [h.lon, h.lat]) <= wp.radiusKm;
  });
}

/** Is month m inside [start, end], wrapping over the year end (e.g. Oct–Mar)? */
export function inSeason(m: number, s: Pick<Season, "start_month" | "end_month">): boolean {
  return s.start_month <= s.end_month ? m >= s.start_month && m <= s.end_month : m >= s.start_month || m <= s.end_month;
}

/** circular month distance, 0..6 */
export const monthDist = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 12;
  return Math.min(d, 12 - d);
};

export function seasonLevel(month: number, season: Season | undefined): Exclude<WatchLevel, "active"> {
  if (!season) return "normal";
  if (monthDist(month, season.peak_month) <= 1) return "high";
  return inSeason(month, season) ? "elevated" : "normal";
}

export interface WatchStatus {
  level: WatchLevel;
  seasonLevel: Exclude<WatchLevel, "active">;
  /** null = not checked (no FIRMS key / not loaded / failed) */
  hotspots: Hotspot[] | null;
  maxFrp: number;
  reasons: string[];
}

export function assessWatchpoint(args: { month: number; season?: Season; near: Hotspot[] | null; outsideCoverage?: boolean }): WatchStatus {
  const sl = seasonLevel(args.month, args.season);
  const reasons: string[] = [];
  const n = args.near?.length ?? 0;
  const maxFrp = args.near ? Math.max(0, ...args.near.map((h) => h.frp)) : 0;
  if (args.near && n > 0) reasons.push(`VIIRS detected ${n} hotspot${n === 1 ? "" : "s"} within the radius in the last ${ACTIVE_HOURS} h (max FRP ${maxFrp.toFixed(1)} MW)`);
  else if (args.near) reasons.push(`No hotspots within the radius in the last ${ACTIVE_HOURS} h`);
  if (args.outsideCoverage) reasons.push("No fire-season statistics here (outside the 6 countries the calendar covers), so the level depends on hotspots only");
  else if (sl === "high") reasons.push("Peak of the regional fire season (2001–2024 statistics)");
  else if (sl === "elevated") reasons.push("Within the regional fire season (2001–2024 statistics)");
  else reasons.push("Outside the regional fire season");
  return { level: n > 0 ? "active" : sl, seasonLevel: sl, hotspots: args.near, maxFrp, reasons };
}
