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
  if (header == null) throw new FireCalendarError("server", "FIRMS ไม่ส่งข้อมูลกลับมา (ตรวจ MAP_KEY และช่วงวันที่)");
  return [header, ...out].join("\n");
}

export async function downloadFirmsCsv(key: string, box: Box, startDate: string, endDate: string, source: FirmsSource): Promise<string> {
  if (!key) throw new FireCalendarError("not_configured", "ยังไม่ได้ตั้ง VITE_FIRMS_MAP_KEY", 503);
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
  return joinCsvChunks(parts);
}

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
  if (min && startDate < min) throw new FireCalendarError("validation", `${source} มีข้อมูลตั้งแต่ ${min}`, 400);
  if (source.endsWith("_NRT") && source !== "VIIRS_NOAA21_NRT" && startDate < addDays(today, -NRT_MAX_AGE_DAYS))
    throw new FireCalendarError("validation", `${source} เก็บเฉพาะข้อมูลล่าสุดราว ${NRT_MAX_AGE_DAYS} วัน ถ้าต้องการข้อมูลเก่าเลือกแบบ _SP`, 400);
  if (endDate > today) throw new FireCalendarError("validation", "วันสิ้นสุดอยู่ในอนาคต", 400);
}

/** Data rows only (excludes the header and "# missing" comment lines). */
export function countCsvRows(csv: string): number {
  return csv.split("\n").filter((l, i) => i > 0 && l.trim() !== "" && !l.startsWith("#")).length;
}
