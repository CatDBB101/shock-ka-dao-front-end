import { useMemo } from "react";
import type { CalendarRow } from "../../lib/firecalendar";

const REGION_TH: Record<string, string> = {
  africa: "Africa (Angola)",
  south_america: "South America (Argentina + Brazil)",
  canada_usa: "Canada + United States",
  australia: "Australia",
};
export const regionTh = (r: string) => REGION_TH[r] ?? r;

/** Yearly totals: raw MODIS (grey) vs harmonized value (ember) vs model on VIIRS years (blue dashed). */
export function ContinuityChart({ rows, title }: { rows: CalendarRow[]; title?: string }) {
  const years = useMemo(() => {
    const m = new Map<number, { modis: number; value: number; model: number; obs: boolean }>();
    for (const r of rows) {
      const y = m.get(r.year) ?? { modis: 0, value: 0, model: 0, obs: false };
      y.modis += r.modis;
      y.value += r.value;
      y.model += r.viirs_model;
      y.obs ||= r.source === "observed";
      m.set(r.year, y);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [rows]);
  if (years.length < 2) return null;

  const W = 560,
    H = 220,
    L = 52,
    R = 12,
    T = 14,
    B = 26;
  const y0 = years[0]![0],
    y1 = years.at(-1)![0];
  const max = Math.max(...years.flatMap(([, v]) => [v.value, v.modis, v.model])) * 1.08 || 1;
  const x = (y: number) => L + ((y - y0) / (y1 - y0)) * (W - L - R);
  const y = (v: number) => H - B - (v / max) * (H - T - B);
  const path = (pick: (v: (typeof years)[number][1]) => number, only?: (yr: number) => boolean) =>
    years
      .filter(([yr]) => !only || only(yr))
      .map(([yr, v], i) => `${i ? "L" : "M"}${x(yr).toFixed(1)} ${y(pick(v)).toFixed(1)}`)
      .join("");
  const fmtK = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(Math.round(v)));
  const ticks = [0, 0.5, 1].map((t) => t * max);
  const seam = 2012;

  return (
    <figure className="fc-chart" style={{ margin: 0 }}>
      {title && <figcaption className="small" style={{ fontWeight: 600, marginBottom: 4 }}>{title}</figcaption>}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Annual fire detections ${title ?? ""}: orange line is calibrated, grey line is raw MODIS, dashed vertical line marks 2012 when VIIRS starts`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--fc-line)" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end">
              {fmtK(t)}
            </text>
          </g>
        ))}
        {seam >= y0 && seam <= y1 && (
          <g>
            <line x1={x(seam)} x2={x(seam)} y1={T} y2={H - B} stroke="var(--fc-muted)" strokeDasharray="4 4" />
            <text x={x(seam) + 4} y={T + 10}>
              2012 VIIRS starts
            </text>
          </g>
        )}
        <path d={path((v) => v.modis)} fill="none" stroke="var(--fc-modis)" strokeWidth={2} />
        <path d={path((v) => v.model, (yr) => yr >= seam)} fill="none" stroke="var(--fc-viirs)" strokeWidth={1.5} strokeDasharray="5 3" />
        <path d={path((v) => v.value)} fill="none" stroke="var(--fc-ember)" strokeWidth={2.5} />
        {[y0, Math.round((y0 + y1) / 2), y1].map((yr) => (
          <text key={yr} x={x(yr)} y={H - 6} textAnchor="middle">
            {yr}
          </text>
        ))}
      </svg>
      <div className="fc-legend">
        <span>
          <i className="fc-swatch" style={{ background: "var(--fc-ember)", height: 3 }} />
          Calibrated (value)
        </span>
        <span>
          <i className="fc-swatch" style={{ background: "var(--fc-modis)", height: 3 }} />
          Raw MODIS (before)
        </span>
        <span>
          <i className="fc-swatch" style={{ background: "var(--fc-viirs)", height: 3 }} />
          Model during the VIIRS era (continuity check)
        </span>
      </div>
    </figure>
  );
}
