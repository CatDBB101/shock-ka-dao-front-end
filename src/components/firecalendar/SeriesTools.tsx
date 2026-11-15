// Scientist-mode tools: pick which instrument colours the calendar, export the AOI time series.
import type { AoiRow, Box, YearMonth } from "../../lib/firecalendar";
import { saveText } from "../../lib/firecalendar";
import { SERIES_LABEL_EN, seriesValue, type Series } from "./CalendarGrid";

const SERIES: readonly Series[] = ["harmonized", "modis", "viirs"];

export function SeriesTabs({ value, onChange }: { value: Series; onChange: (s: Series) => void }) {
  return (
    <div className="tabs" role="group" aria-label="Data series used to colour the calendar">
      {SERIES.map((s) => (
        <button key={s} type="button" aria-pressed={value === s} onClick={() => onChange(s)}>
          {SERIES_LABEL_EN[s]}
        </button>
      ))}
    </div>
  );
}

const COLS = ["year", "month", "source", "harmonized", "p_lo", "p_hi", "modis", "viirs_obs", "viirs_model", "clim_median", "pct_vs_ref"] as const;

/** Monthly AOI series with all three instruments side by side. Empty cell = no data (e.g. VIIRS before 2012). */
export function aoiToCsv(rows: AoiRow[]): string {
  const cell = (v: number | string | null | undefined) => (v == null ? "" : String(v));
  const lines = rows.map((r) => {
    const rec: Record<(typeof COLS)[number], number | string | null> = {
      year: r.year,
      month: r.month,
      source: r.source,
      harmonized: r.value,
      p_lo: r.p_lo,
      p_hi: r.p_hi,
      modis: r.modis,
      viirs_obs: seriesValue(r, "viirs"),
      viirs_model: r.viirs_model,
      clim_median: r.clim_median,
      pct_vs_ref: r.pct_vs_ref,
    };
    return COLS.map((c) => cell(rec[c])).join(",");
  });
  return [COLS.join(","), ...lines].join("\n");
}

export function AoiCalendarCsvButton({ rows, box, start, end }: { rows: AoiRow[]; box: Box; start: YearMonth; end: YearMonth }) {
  const tag = [box.minLat, box.minLon, box.maxLat, box.maxLon].map((n) => n.toFixed(2)).join("_");
  return (
    <button type="button" className="btn" onClick={() => saveText(aoiToCsv(rows), `firecalendar_aoi_${tag}_${start}_${end}.csv`)}>
      Download calendar for this area (CSV · {rows.length} months)
    </button>
  );
}