import { LEVEL_LABEL_TH, monthTh, type Season } from "../../lib/firecalendar";
import type { Series } from "./CalendarGrid";

export function Legend({ showModis = false, series: seriesProp }: { showModis?: boolean; series?: Series }) {
  const series: Series = seriesProp ?? (showModis ? "modis" : "harmonized");
  return (
    <div className="fc-legend" aria-label="คำอธิบายสี">
      {LEVEL_LABEL_TH.map((l, i) => (
        <span key={l}>
          <i className={`fc-swatch fc-cell lvl-${i}`} aria-hidden="true" />
          {l}
        </span>
      ))}
      {series === "harmonized" && (
        <>
          <span>
            <i className="fc-swatch fc-cell lvl-2" aria-hidden="true" />
            VIIRS วัดจริง (observed)
          </span>
          <span>
            <i className="fc-swatch fc-cell lvl-2 src-backcast" aria-hidden="true" />
            ลายห่าง = แปลงจาก MODIS (backcast)
          </span>
          <span>
            <i className="fc-swatch fc-cell lvl-2 src-backcast_terra" aria-hidden="true" />
            ลายถี่ = แปลงจาก Terra (แม่นน้อยกว่า)
          </span>
          <span>
            <i className="fc-swatch fc-cell lvl-2 critical" aria-hidden="true" />
            กรอบหนา = เดือนวิกฤต (สูงกว่าเดือนเดียวกันใน 2013–2024 ≥ 90% ของปี)
          </span>
        </>
      )}
      {series === "modis" && <span>สีตามจำนวนจุด MODIS ดิบ (ก่อนปรับเทียบ) · สเกลสีคิดแยกจากชุดอื่น</span>}
      {series === "viirs" && (
        <>
          <span>
            <i className="fc-swatch fc-cell no-data" aria-hidden="true" />
            ไม่มีข้อมูล VIIRS (ก่อน ก.พ. 2012)
          </span>
          <span>สีตามจำนวนจุดที่ VIIRS S-NPP วัดได้จริง</span>
        </>
      )}
    </div>
  );
}

export function SeasonLine({ season }: { season?: Season }) {
  if (!season) return null;
  return (
    <p className="small muted">
      ฤดูไฟ: {monthTh(season.start_month)}–{monthTh(season.end_month)} · พีค {monthTh(season.peak_month)}
    </p>
  );
}
