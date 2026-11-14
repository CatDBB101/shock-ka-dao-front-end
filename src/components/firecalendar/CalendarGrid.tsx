import { useMemo, useState } from "react";
import type { CalendarCell } from "../../lib/firecalendar";
import { colourSteps, CRITICAL_PCT, fmtCount, monthTh, MONTHS_TH, SOURCE_LABEL_TH } from "../../lib/firecalendar";

/** Which number colours the cell. harmonized = FireCalendar+ (VIIRS-equivalent), modis = raw MODIS, viirs = measured VIIRS only. */
export type Series = "harmonized" | "modis" | "viirs";
export const SERIES_LABEL_TH: Record<Series, string> = {
  harmonized: "Harmonized (เทียบเท่า VIIRS)",
  modis: "MODIS ดิบ",
  viirs: "VIIRS วัดจริง",
};

/** value of a cell for a series; null = that instrument has no data for the month (VIIRS before Feb 2012) */
export function seriesValue(c: CalendarCell, series: Series): number | null {
  if (series === "modis") return c.modis;
  if (series === "viirs") return c.source === "observed" ? (c.viirs_obs ?? c.value) : null;
  return c.value;
}

export interface CalendarGridProps<T extends CalendarCell> {
  rows: T[];
  /** "before calibration": colour by raw MODIS (same as series="modis") */
  showModis?: boolean;
  series?: Series;
  onPick?: (cell: T) => void;
  selected?: { year: number; month: number } | null;
  /** false for small AOIs (cells < 20): critical months are unreliable */
  markCritical?: boolean;
  label?: string;
}

export const isCritical = (c: CalendarCell) => (c.pct_vs_ref ?? 0) >= CRITICAL_PCT;

export function cellSentence(c: CalendarCell, showModis: boolean | Series = false, markCritical = true): string {
  const when = `${monthTh(c.month)} ${c.year}`;
  const series: Series = showModis === true ? "modis" : showModis === false ? "harmonized" : showModis;
  if (series === "modis") return `${when}: MODIS ดิบ ${fmtCount(c.modis)} จุด (ก่อนปรับเทียบ)`;
  if (series === "viirs") {
    const v = seriesValue(c, "viirs");
    return v == null ? `${when}: ไม่มีข้อมูล VIIRS (เริ่ม ก.พ. 2012)` : `${when}: VIIRS วัดจริง ${fmtCount(v)} จุด`;
  }
  const computed = c.source !== "observed";
  let s = `${when}: ${fmtCount(c.value, computed)} จุด · ${SOURCE_LABEL_TH[c.source]}`;
  if (computed && c.value > 0) s += ` · ช่วงที่น่าจะเป็น ${fmtCount(c.p_lo)}–${fmtCount(c.p_hi)}`;
  if (markCritical && isCritical(c)) s += " · เดือนวิกฤต";
  return s;
}

export function CalendarGrid<T extends CalendarCell>({ rows, showModis = false, series: seriesProp, onPick, selected, markCritical = true, label }: CalendarGridProps<T>) {
  const [tip, setTip] = useState("");
  const series: Series = seriesProp ?? (showModis ? "modis" : "harmonized");
  const step = useMemo(
    () => colourSteps(rows.map((r) => seriesValue(r, series)).filter((v): v is number => v != null)),
    [rows, series],
  );
  const years = useMemo(() => [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b), [rows]);
  const byKey = useMemo(() => new Map(rows.map((r) => [r.year * 12 + r.month, r])), [rows]);

  return (
    <div>
      <div className="fc-cal-scroll">
        <div className="fc-cal" role="grid" aria-label={label ?? "ปฏิทินไฟรายเดือน"} aria-rowcount={years.length + 1} aria-colcount={13}>
          <div role="row">
            <div role="columnheader" aria-label="ปี" />
            {MONTHS_TH.map((m) => (
              <div key={m} role="columnheader">
                {m}
              </div>
            ))}
          </div>
          {years.map((y) => (
            <div role="row" key={y}>
              <div role="rowheader">{y}</div>
              {Array.from({ length: 12 }, (_, i) => {
                const c = byKey.get(y * 12 + i + 1);
                if (!c) return <div key={i} role="gridcell" aria-label={`${monthTh(i + 1)} ${y}: นอกช่วงที่เลือก`} />;
                const text = cellSentence(c, series, markCritical);
                const crit = markCritical && series === "harmonized" && isCritical(c);
                const sel = selected && selected.year === c.year && selected.month === c.month;
                const src = series === "harmonized" ? c.source : "observed";
                const v = seriesValue(c, series);
                return (
                  <div role="gridcell" key={i} style={{ display: "contents" }}>
                    <button
                      type="button"
                      className={`fc-cell ${v == null ? "no-data" : `lvl-${step(v)}`} src-${src}${crit ? " critical" : ""}${sel ? " selected" : ""}`}
                      aria-label={text}
                      aria-pressed={onPick ? Boolean(sel) : undefined}
                      onMouseEnter={() => setTip(text)}
                      onFocus={() => setTip(text)}
                      onClick={() => onPick?.(c)}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="fc-tip" aria-live="polite">
        {tip || <span className="muted">ชี้หรือกด Tab ที่ช่องเพื่อดูรายละเอียด</span>}
      </div>
    </div>
  );
}

/** 24×12 faded grid while loading — same size as the real one, so no layout shift. */
export function CalendarSkeleton({ years = 24, message = "กำลังโหลด…" }: { years?: number; message?: string }) {
  return (
    <div aria-busy="true">
      <div className="fc-cal-scroll">
        <div className="fc-cal skeleton" aria-hidden="true">
          <div />
          {MONTHS_TH.map((m) => (
            <div key={m} role="columnheader">
              {m}
            </div>
          ))}
          {Array.from({ length: years }, (_, y) => [
            <div key={`y${y}`} role="rowheader">
              {2001 + y}
            </div>,
            ...Array.from({ length: 12 }, (_, i) => <div key={`${y}-${i}`} className="fc-cell" />),
          ])}
        </div>
      </div>
      <p className="fc-tip" role="status">
        {message}
      </p>
    </div>
  );
}
