import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  calendarToCsv,
  config,
  errorMessageEn,
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
      <h1>Data</h1>
      <p className="muted">Take the data for further use. All numbers are fire point counts that VIIRS S-NPP (375 m) would likely detect. Vegetation fires only, day and night combined.</p>
      <div className="table-scroll">
        <table className="fc-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Link / Button</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Regional calendar (JSON)</td>
              <td>{base ? <a href={`${base}/${file("calendar_region")}`}>{file("calendar_region")}</a> : <a href={`${config.api}/v1/calendar/region?region=africa`}>/v1/calendar/region</a>}</td>
              <td>340 KB · 1,152 rows</td>
            </tr>
            <tr>
              <td>Regional calendar (CSV)</td>
              <td>
                <button className="btn" type="button" disabled={want} onClick={failed ? retry : () => setWant(true)}>
                  {want ? "Preparing…" : failed ? "Retry" : "Download CSV"}
                </button>
                {failed && !want && <span className="error" role="alert"> Failed to load ({errorMessageEn(toFireCalendarError(regions.find((q) => q.error)?.error))})</span>}
              </td>
              <td>Generated in browser, opens in Excel</td>
            </tr>
            <tr>
              <td>Per-cell data (Parquet)</td>
              <td>
                {base ? (
                  <>
                    <a href={`${base}/${file("cell_month")}`}>{file("cell_month")}</a> · <a href={`${base}/${file("cell_index")}`}>{file("cell_index")}</a>
                  </>
                ) : (
                  "Use /v1/calendar/aoi"
                )}
              </td>
              <td>41 MB · H3 r5 × month (sparse storage)</td>
            </tr>
            <tr>
              <td>API</td>
              <td>{ds.mode === "api" ? <a href={`${config.api}/docs`}>{config.api}/docs</a> : <span className="muted">Not deployed (mode: {ds.mode})</span>}</td>
              <td>FastAPI · GET only</td>
            </tr>
            <tr>
              <td>Version</td>
              <td className="num">
                {meta.data ? `${meta.data.data_version} · ${meta.data.model_id} · ${meta.data.generated}` : "…"}
              </td>
              <td>Append to URL to bust cache when data changes</td>
            </tr>
            <tr>
              <td>Citation</td>
              <td colSpan={2}>NASA FIRMS (MODIS C6.1, VIIRS 375 m), MCD12C1 · FireCalendar+ v3</td>
            </tr>
          </tbody>
        </table>
      </div>

      <section aria-labelledby="raw" className="panel stack" style={{ marginTop: 32 }}>
        <h2 id="raw">Raw NASA Fire Points (CSV)</h2>
        {ds.canDownloadHotspots && (
          <label className="field" style={{ maxWidth: 360 }}>
            Area
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