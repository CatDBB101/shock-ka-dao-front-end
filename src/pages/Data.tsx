import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  calendarToCsv,
  config,
  errorMessageTh,
  REGIONS,
  resolveFile,
  saveText,
  toFireCalendarError,
  useDataSource,
  useMeta,
  type Box,
} from "../lib/firecalendar";
import { DownloadCsvButton, EXAMPLE_AREAS } from "../components/firecalendar";

export default function Data() {
  const ds = useDataSource();
  const meta = useMeta();
  const base = ds.filesBase;
  const [area, setArea] = useState<Box>(EXAMPLE_AREAS[0]!.box);
  const [want, setWant] = useState(false);

  // all 4 regions = the full 1,152-row calendar
  // same keys as useRegionCalendar → shares its cache
  const regions = useQueries({
    queries: REGIONS.map((r) => ({
      queryKey: ["fc", ds.mode, "region", r, "2001-01", "2024-12"],
      queryFn: async () => {
        try {
          return await ds.getRegionCalendar(r, "2001-01", "2024-12");
        } catch (e) {
          throw toFireCalendarError(e);
        }
      },
      enabled: want,
    })),
  });
  const ready = regions.every((q) => q.data);
  const failed = regions.some((q) => q.isError);
  const version = meta.data?.data_version ?? "data";
  useEffect(() => {
    if (!want) return;
    if (failed) {
      setWant(false); // let the user retry
      return;
    }
    if (!ready) return;
    const rows = regions.flatMap((q) => q.data!.rows);
    saveText(calendarToCsv(rows), `firecalendar_region_${version}.csv`);
    setWant(false);
  }, [want, ready, failed, regions, version]);
  const retry = () => {
    regions.forEach((q) => q.isError && void q.refetch());
    setWant(true);
  };

  const file = (k: "calendar_region" | "cell_index" | "cell_month") => resolveFile(meta.data ?? null, k);

  return (
    <>
      <h1>ข้อมูล</h1>
      <p className="muted">เอาข้อมูลไปใช้ต่อได้ทันที ทุกตัวเลขเป็นจำนวนจุดไฟที่ VIIRS S-NPP (375 ม.) น่าจะตรวจพบ เฉพาะไฟพืชพรรณ รวมกลางวันและกลางคืน</p>
      <div className="table-scroll">
        <table className="fc-table">
          <thead>
            <tr>
              <th>รายการ</th>
              <th>ลิงก์ / ปุ่ม</th>
              <th>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>ปฏิทินภูมิภาค (JSON)</td>
              <td>{base ? <a href={`${base}/${file("calendar_region")}`}>{file("calendar_region")}</a> : <a href={`${config.api}/v1/calendar/region?region=africa`}>/v1/calendar/region</a>}</td>
              <td>340 KB · 1,152 แถว</td>
            </tr>
            <tr>
              <td>ปฏิทินภูมิภาค (CSV)</td>
              <td>
                <button className="btn" type="button" disabled={want} onClick={failed ? retry : () => setWant(true)}>
                  {want ? "กำลังเตรียม…" : failed ? "ลองใหม่" : "ดาวน์โหลด CSV"}
                </button>
                {failed && !want && <span className="error" role="alert"> โหลดไม่สำเร็จ ({errorMessageTh(toFireCalendarError(regions.find((q) => q.error)?.error))})</span>}
              </td>
              <td>สร้างในเบราว์เซอร์ เปิดใน Excel ได้</td>
            </tr>
            <tr>
              <td>ข้อมูลรายช่อง (Parquet)</td>
              <td>
                {base ? (
                  <>
                    <a href={`${base}/${file("cell_month")}`}>{file("cell_month")}</a> · <a href={`${base}/${file("cell_index")}`}>{file("cell_index")}</a>
                  </>
                ) : (
                  "ใช้ /v1/calendar/aoi"
                )}
              </td>
              <td>41 MB · H3 r5 × เดือน (เก็บแบบบาง)</td>
            </tr>
            <tr>
              <td>API</td>
              <td>{ds.mode === "api" ? <a href={`${config.api}/docs`}>{config.api}/docs</a> : <span className="muted">ยังไม่ deploy (โหมด {ds.mode})</span>}</td>
              <td>FastAPI · GET อย่างเดียว</td>
            </tr>
            <tr>
              <td>เลขรุ่น</td>
              <td className="num">
                {meta.data ? `${meta.data.data_version} · ${meta.data.model_id} · ${meta.data.generated}` : "…"}
              </td>
              <td>ต่อท้าย URL เพื่อล้าง cache เมื่อข้อมูลเปลี่ยน</td>
            </tr>
            <tr>
              <td>การอ้างอิง</td>
              <td colSpan={2}>NASA FIRMS (MODIS C6.1, VIIRS 375 m), MCD12C1 · FireCalendar+ v3</td>
            </tr>
          </tbody>
        </table>
      </div>

      <section aria-labelledby="raw" className="panel stack" style={{ marginTop: 32 }}>
        <h2 id="raw">จุดไฟดิบ NASA (CSV)</h2>
        {ds.canDownloadHotspots && (
          <label className="field" style={{ maxWidth: 360 }}>
            พื้นที่
            <select
              value={EXAMPLE_AREAS.findIndex((a) => a.box === area)}
              onChange={(e) => setArea(EXAMPLE_AREAS[Number(e.target.value)]!.box)}
            >
              {EXAMPLE_AREAS.map((a, i) => (
                <option key={a.id} value={i}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <DownloadCsvButton box={area} />
      </section>
    </>
  );
}
