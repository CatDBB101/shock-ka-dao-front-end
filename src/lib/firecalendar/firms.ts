// NASA FIRMS Area API (layer 6) — raw hotspots CSV, static mode only.
// Note coordinate order: lon,lat,lon,lat (W,S,E,N). Max 5 days per request.
import type { Box, FirmsSource } from "./types";
import { FireCalendarError } from "./errors";
import { addDays, daysBetween } from "./time";
import { validateBox, validateDays } from "./validate";

const FIRMS = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";

export function firmsChunkUrls(key: string, box: Box, startDate: string, endDate: string, source: FirmsSource): string[] {
  const area = [box.minLon, box.minLat, box.maxLon, box.maxLat].join(",");
  const total = daysBetween(startDate, endDate);
  const urls: string[] = [];
  for (let off = 0; off < total; off += 5) {
    const days = Math.min(5, total - off);
    urls.push(`${FIRMS}/${encodeURIComponent(key)}/${source}/${area}/${days}/${addDays(startDate, off)}`);
  }
  return urls;
}

/** Concatenate chunk CSVs keeping one header. Failed chunks become `# ...` lines. */
export function joinCsvChunks(parts: { range: string; text: string | null }[]): string {
  let header: string | null = null;
  const out: string[] = [];
  for (const p of parts) {
    if (p.text == null || !p.text.startsWith("latitude")) {
      out.push(`# missing ${p.range}${p.text ? `: ${p.text.split("\n")[0]}` : ""}`);
      continue;
    }
    const lines = p.text.trim().split(/\r?\n/);
    header ??= lines[0]!;
    out.push(...lines.slice(1));
  }
  if (header == null) throw new FireCalendarError("server", "FIRMS returned no data (check the MAP_KEY and the date range)");
  return [header, ...out].join("\n");
}

/**
 * Keep vegetation fires only (`type == 0`), like the research pipeline: drops volcanoes (1),
 * other static land sources such as gas flares (2) and offshore (3). FIRMS only ships `type`
 * in standard-processing (SP) files; when the column is absent the CSV is returned unchanged.
 */
export function keepVegetationFires(csv: string): { csv: string; dropped: number; filtered: boolean } {
  const lines = csv.split("\n");
  const iHead = lines.findIndex((l) => l.startsWith("latitude"));
  const iType = iHead >= 0 ? lines[iHead]!.split(",").map((s) => s.trim()).indexOf("type") : -1;
  if (iType < 0) return { csv, dropped: 0, filtered: false };
  let dropped = 0;
  const kept = lines.filter((l, i) => {
    if (i <= iHead || l.trim() === "" || l.startsWith("#")) return true;
    const t = l.split(",")[iType]?.trim();
    if (t === undefined || t === "" || t === "0") return true;
    dropped++;
    return false;
  });
  return { csv: kept.join("\n"), dropped, filtered: true };
}

export async function downloadFirmsCsv(key: string, box: Box, startDate: string, endDate: string, source: FirmsSource): Promise<string> {
  if (!key) throw new FireCalendarError("not_configured", "VITE_FIRMS_MAP_KEY is not set", 503);
  validateBox(box);
  validateDays(startDate, endDate);
  validateFirmsDates(source, startDate, endDate);
  const urls = firmsChunkUrls(key, box, startDate, endDate, source);
  // ≤ 12 chunks: fetch in parallel, each with its own timeout; a failed chunk becomes a "# missing" line
  const parts = await Promise.all(
    urls.map(async (url, i) => {
      const from = addDays(startDate, i * 5);
      const range = `${from}..${addDays(from, 4)}`;
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(CHUNK_TIMEOUT_MS) });
        return { range, text: r.ok ? await r.text() : null };
      } catch {
        return { range, text: null };
      }
    }),
  );
  const veg = keepVegetationFires(joinCsvChunks(parts));
  return veg.dropped ? `${veg.csv}\n# removed ${veg.dropped} non-vegetation detections (type != 0: volcano / static source / offshore)` : veg.csv;
}

/** S-NPP stopped delivering to FIRMS on this date; newer data comes from NOAA-20 / NOAA-21. */
export const SNPP_LAST_DATE = "2026-11-02";

const CHUNK_TIMEOUT_MS = 45_000;

/**
 * Earliest date each FIRMS source has (from /api/data_availability, Nov 2026).
 * NRT sources only keep roughly the last 2–3 months; SP (standard) sources are archives.
 */
const FIRMS_MIN_DATE: Record<FirmsSource, string> = {
  MODIS_SP: "2000-11-01",
  VIIRS_SNPP_SP: "2012-01-20",
  VIIRS_NOAA20_SP: "2018-04-01",
  MODIS_NRT: "",
  VIIRS_SNPP_NRT: "",
  VIIRS_NOAA20_NRT: "",
  VIIRS_NOAA21_NRT: "2024-01-17",
};
const NRT_MAX_AGE_DAYS = 90;

export function validateFirmsDates(source: FirmsSource, startDate: string, endDate: string, today = new Date().toISOString().slice(0, 10)): void {
  const min = FIRMS_MIN_DATE[source];
  if (min && startDate < min) throw new FireCalendarError("validation", `${source} has data from ${min}`, 400);
  if (source.startsWith("VIIRS_SNPP") && endDate > SNPP_LAST_DATE)
    throw new FireCalendarError("validation", `S-NPP stopped delivering data on ${SNPP_LAST_DATE}. End before then, or use VIIRS_NOAA20 / VIIRS_NOAA21`, 400);
  if (source.endsWith("_NRT") && source !== "VIIRS_NOAA21_NRT" && startDate < addDays(today, -NRT_MAX_AGE_DAYS))
    throw new FireCalendarError("validation", `${source} keeps only about the last ${NRT_MAX_AGE_DAYS} days. For older data choose an _SP source`, 400);
  if (endDate > today) throw new FireCalendarError("validation", "The end date is in the future", 400);
}

/** Data rows only (excludes the header and "# missing" comment lines). */
export function countCsvRows(csv: string): number {
  return csv.split("\n").filter((l, i) => i > 0 && l.trim() !== "" && !l.startsWith("#")).length;
}
