import { useState } from "react";
import type { Box, FirmsSource } from "../../lib/firecalendar";
import { countCsvRows, validateFirmsDates } from "../../lib/firecalendar/firms";
import { addDays, FIRMS_SOURCES, MAX_HOTSPOT_DAYS, saveText, useDataSource, validateDays, toFireCalendarError, errorMessageTh } from "../../lib/firecalendar";

/** Raw NASA FIRMS hotspots for a box, ≤ 60 days. Hidden when the mode can't export. */
export function DownloadCsvButton({ box }: { box: Box }) {
  const ds = useDataSource();
  // default = peak of the Aug 2022 Rosario fires (Aug 1–10 had none, which looked like a failure)
  const [start, setStart] = useState("2022-08-20");
  const [end, setEnd] = useState("2022-08-29");
  const [source, setSource] = useState<FirmsSource>("VIIRS_SNPP_SP");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!ds.canDownloadHotspots)
    return (
      <p className="small muted">
        ยังไม่เปิดใช้: ต้องตั้ง <code>VITE_FIRMS_MAP_KEY</code> ใน <code>.env.local</code> (ขอฟรีที่{" "}
        <a href="https://firms.modaps.eosdis.nasa.gov/api/map_key">NASA FIRMS</a>)
      </p>
    );

  let rangeErr: string | null = null;
  try {
    validateDays(start, end);
    validateFirmsDates(source, start, end);
  } catch (e) {
    rangeErr = e instanceof Error ? e.message : String(e);
  }
  const href = rangeErr ? null : ds.hotspotsCsvUrl(box, start, end, source);
  const filename = `firms_${source}_${start}_${end}.csv`;

  const download = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const csv = await ds.downloadHotspotsCsv(box, start, end, source);
      saveText(csv, filename);
      const missing = csv.split("\n").filter((l) => l.startsWith("#")).length;
      const n = countCsvRows(csv);
      setMsg(
        (n === 0 ? "ดาวน์โหลดแล้ว แต่ไม่พบจุดไฟในพื้นที่และช่วงวันนี้" : `ดาวน์โหลดแล้ว (${n.toLocaleString("en-US")} จุด)`) +
          (missing ? ` · ${missing} ช่วงโหลดไม่สำเร็จ ดูบรรทัดที่ขึ้นต้นด้วย #` : ""),
      );
    } catch (e) {
      const fe = toFireCalendarError(e);
      setMsg(fe.kind === "validation" || fe.kind === "server" ? fe.message : errorMessageTh(fe));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="form-grid">
        <label className="field">
          วันเริ่ม
          <input type="date" value={start} min="2000-11-01" onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field">
          วันสิ้นสุด (ไม่เกิน {MAX_HOTSPOT_DAYS} วัน)
          <input type="date" value={end} max={addDays(start, MAX_HOTSPOT_DAYS - 1)} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <label className="field">
          ดาวเทียม (source)
          <select value={source} onChange={(e) => setSource(e.target.value as FirmsSource)}>
            {FIRMS_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="row">
        {href ? (
          <a className="btn" href={href} download={filename}>
            ดาวน์โหลดจุดไฟดิบ NASA (CSV)
          </a>
        ) : (
          <button className="btn" type="button" disabled={busy || Boolean(rangeErr)} onClick={download}>
            {busy ? "กำลังดาวน์โหลด…" : "ดาวน์โหลดจุดไฟดิบ NASA (CSV)"}
          </button>
        )}
        {rangeErr && <span className="error" role="alert">{rangeErr}</span>}
        {msg && <span className="small" role="status">{msg}</span>}
      </div>
    </div>
  );
}
