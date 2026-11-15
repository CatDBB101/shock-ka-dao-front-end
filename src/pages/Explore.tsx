import { lazy, Suspense, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { AoiRow, Box, YearMonth } from "../lib/firecalendar";
import {
  boxToParam,
  COVERED_COUNTRIES_EN,
  fmtCount,
  FIRST_YM,
  LAST_YM,
  MIN_CELLS_FOR_CRITICAL,
  monthEn,
  parseYm,
  readBoxFromUrl,
  readHexFromUrl,
  hexToParam,
  hexagonRing,
  ringBox,
  validateHexagon,
  type Hexagon,
  SOURCE_LABEL_EN,
  useAoiCalendar,
  validateRange,
} from "../lib/firecalendar";
import {
  AoiForm,
  CalendarGrid,
  CalendarSkeleton,
  DownloadCsvButton,
  EXAMPLE_AREAS,
  exampleName,
  isCritical,
  Legend,
  LoadError,
  regionEn,
  SeriesTabs,
  AoiCalendarCsvButton,
  type Series,
} from "../components/firecalendar";

import { HeatStrata, type StrataMode } from "../components/hero/HeatStrata";

// the map (maplibre + h3) is large → load it only on this page
const AoiMap = lazy(() => import("../components/firecalendar/AoiMap"));

const ymOk = (v: string | null): v is YearMonth => Boolean(v && parseYm(v));

export default function Explore() {
  const [sp, setSp] = useSearchParams();
  const urlBox = useMemo(() => readBoxFromUrl(sp), [sp]);
  const hex = useMemo(() => readHexFromUrl(sp), [sp]);
  let hexErr: string | null = null;
  if (hex) {
    try {
      validateHexagon(hex);
    } catch (e) {
      hexErr = e instanceof Error ? e.message : String(e);
    }
  }
  // hexagon AOI: bbox for the coarse filter + exact ring for point-in-polygon
  const ring = useMemo(() => (hex && !hexErr ? hexagonRing(hex) : undefined), [hex, hexErr]);
  const box = useMemo(() => (ring ? ringBox(ring) : hex ? null : urlBox), [ring, hex, urlBox]);
  const start = ymOk(sp.get("start")) ? sp.get("start")! : FIRST_YM;
  const end = ymOk(sp.get("end")) ? sp.get("end")! : LAST_YM;
  let rangeErr: string | null = null;
  try {
    validateRange(start, end);
  } catch (e) {
    rangeErr = e instanceof Error ? e.message : String(e);
  }

  const q = useAoiCalendar(rangeErr || hexErr ? null : box, start, end, ring);
  const [picked, setPicked] = useState<AoiRow | null>(null);
  const [showAllCrit, setShowAllCrit] = useState(false);
  const view3d = sp.get("view") === "3d";
  const [morph, setMorph] = useState<StrataMode>("harmonized");
  const setView = (v: "grid" | "3d") => {
    const n = new URLSearchParams(sp);
    if (v === "3d") n.set("view", "3d");
    else n.delete("view");
    setSp(n, { replace: true });
  };
  const series: Series = sp.get("series") === "modis" || sp.get("series") === "viirs" ? (sp.get("series") as Series) : "harmonized";

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v == null) next.delete(k);
      else next.set(k, v);
    }
    setPicked(null);
    setSp(next, { replace: false });
  };
  const setBox = (b: Box) => update({ bbox: boxToParam(b), hex: null });
  const setHex = (h: Hexagon) => update({ hex: hexToParam(h), bbox: null });

  const data = q.data;
  const small = data ? data.cells < MIN_CELLS_FOR_CRITICAL : false;
  const crit = useMemo(
    () => (data && !small ? data.rows.filter(isCritical).sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month)) : []),
    [data, small],
  );
  const allZero = data ? data.rows.every((r) => r.value === 0) : false;
  const placeName = hex ? `Hexagon radius ${Math.round(hex.radiusKm).toLocaleString("en-US")} km` : (exampleName(box) ?? "Selected area");
  const validationMsg = q.error?.kind === "validation" ? q.error.message : null;

  return (
    <>
      <h1>Explore Area</h1>
      <p className="muted">When does fire occur in this area? Is this year unusual? — Search for a place, draw a hexagon on the map, or enter a coordinate box.</p>

      <section className="panel stack" aria-label="Map">
        <Suspense fallback={<div className="aoi-map-wrap"><div className="aoi-map" /><p className="aoi-map-hint" role="status">Loading map…</p></div>}>
          <AoiMap hexagon={ring ? hex : null} box={ring ? null : urlBox} cells={q.data?.h3} onHexagon={setHex} />
        </Suspense>
        {hexErr && <p className="error" role="alert">{hexErr}</p>}
      </section>

      <section className="panel stack" aria-label="Select area and time range" style={{ marginTop: 16 }}>
        <details open={!hex}>
          <summary className="small" style={{ cursor: "pointer" }}>Or enter coordinate box / choose example area</summary>
          <div style={{ marginTop: 10 }}>
            <AoiForm value={urlBox} onSubmit={setBox} externalError={validationMsg} />
          </div>
        </details>
        <div className="form-grid" style={{ maxWidth: 420 }}>
          <label className="field">
            From month
            <input type="month" min="2001-01" max="2024-12" value={start} onChange={(e) => e.target.value && update({ start: e.target.value })} />
          </label>
          <label className="field">
            To month
            <input type="month" min="2001-01" max="2024-12" value={end} onChange={(e) => e.target.value && update({ end: e.target.value })} />
          </label>
        </div>
        {rangeErr && <p className="error" role="alert">{rangeErr}</p>}
      </section>

      <section aria-live="polite" style={{ marginTop: 24 }}>
        {!box && (
          <div className="panel">
            <p>No area selected yet. Draw a hexagon on the map, enter coordinates, or click an example area:</p>
            <div className="row">
              {EXAMPLE_AREAS.map((a) => (
                <button key={a.id} className="btn ghost" type="button" onClick={() => setBox(a.box)}>
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {box && !rangeErr && q.isPending && <CalendarSkeleton message="Calculating… First load may take a moment (loading processor and data files)" />}

        {q.isError && q.error.kind !== "validation" && (
          <LoadError error={q.error} onRetry={() => void q.refetch()}>
            {q.error.kind === "not_covered" && (
              <div className="row" style={{ marginTop: 8 }}>
                <span className="small">Try example areas:</span>
                {EXAMPLE_AREAS.map((a) => (
                  <button key={a.id} className="btn ghost" type="button" onClick={() => setBox(a.box)}>
                    {a.name}
                  </button>
                ))}
              </div>
            )}
          </LoadError>
        )}

        {data && (
          <div className="stack">
            <p>
              <b className="num">{fmtCount(data.cells)}</b> H3 cells · Main region <b>{regionEn(data.region)}</b> · {start} to {end}
            </p>
            {small && (
              <p className="alert small">
                Small area ({data.cells} cells) — numbers fluctuate, so critical months are not flagged
              </p>
            )}
            {allZero && <p className="alert small">No fire found in this area for the selected period</p>}

            <div className="grid-2">
              <div className="panel stack">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="tabs" role="group" aria-label="Calendar view">
                    <button type="button" aria-pressed={!view3d} onClick={() => setView("grid")}>
                      Table
                    </button>
                    <button type="button" aria-pressed={view3d} onClick={() => setView("3d")}>
                      3D
                    </button>
                  </div>
                </div>
                {view3d ? (
                  <div className="strata-panel">
                    <div className="morph" role="group" aria-label="How to join the two satellites' data">
                      <button type="button" aria-pressed={morph === "spliced"} onClick={() => setMorph("spliced")}>
                        Join directly
                      </button>
                      <button type="button" aria-pressed={morph === "harmonized"} onClick={() => setMorph("harmonized")}>
                        Harmonized
                      </button>
                    </div>
                    <HeatStrata rows={data.rows} mode={morph} compact label={`3D fire calendar for ${placeName}`} />
                  </div>
                ) : (
                  <>
                    <SeriesTabs value={series} onChange={(s) => { const n = new URLSearchParams(sp); if (s === "harmonized") n.delete("series"); else n.set("series", s); setSp(n, { replace: true }); }} />
                    <CalendarGrid
                      rows={data.rows}
                      series={series}
                      onPick={setPicked}
                      selected={picked}
                      markCritical={!small}
                      label={`Fire calendar for ${placeName}`}
                    />
                    <Legend series={series} />
                  </>
                )}
              </div>
              <div className="stack">
                <div className="panel" aria-live="polite">
                  <h3>Details</h3>
                  {picked ? (
                    <CellDetail row={picked} place={placeName} cells={data.cells} small={small} />
                  ) : (
                    <p className="small muted">Click a cell in the calendar to see details for that month</p>
                  )}
                </div>
                <div className="panel">
                  <h3>Critical months</h3>
                  {small ? (
                    <p className="small muted">Not shown for areas smaller than {MIN_CELLS_FOR_CRITICAL} cells</p>
                  ) : crit.length === 0 ? (
                    <p className="small muted">No critical months in the selected period</p>
                  ) : (
                    <>
                      <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
                        {(showAllCrit ? crit : crit.slice(0, 10)).map((r) => (
                          <li key={`${r.year}-${r.month}`}>
                            <button type="button" className="btn ghost" style={{ padding: "2px 8px", margin: "2px 0" }} onClick={() => setPicked(r)}>
                              {monthEn(r.month)} {r.year}
                            </button>{" "}
                            <span className="num">{fmtCount(r.value, r.source !== "observed")}</span> points · Higher than {Math.round(r.pct_vs_ref ?? 0)}% of years
                          </li>
                        ))}
                      </ul>
                      {crit.length > 10 && (
                        <button type="button" className="btn ghost" style={{ marginTop: 8 }} onClick={() => setShowAllCrit((x) => !x)}>
                          {showAllCrit ? "Show less" : `Show all (${crit.length})`}
                        </button>
                      )}
                    </>
                  )}
                </div>
                <div className="panel">
                  <h3>Download</h3>
                  <p className="small muted">
                    Monthly calendar for this area {start} to {end} includes Harmonized, raw MODIS, and measured VIIRS in one file
                  </p>
                  {box && <AoiCalendarCsvButton rows={data.rows} box={box} start={start} end={end} />}
                  <hr style={{ border: 0, borderTop: "1px solid var(--fc-line)", margin: "12px 0" }} />
                  <p className="small muted">
                    Raw NASA FIRMS fire points in this box, max 60 days at a time · All calendar data at <Link to="/data">Data page</Link>
                  </p>
                  {hex && <p className="small muted">FIRMS only accepts rectangular boxes, so download uses the box enclosing the hexagon</p>}
                  {box && <DownloadCsvButton box={box} />}
                </div>
              </div>
            </div>
            {data.note && <p className="note">Note: {data.note}</p>}
            <p className="small">
              <Link to="/evidence">See evidence for how reliable the numbers are →</Link>
            </p>
          </div>
        )}
      </section>
      <p className="small muted" style={{ marginTop: 24 }}>
        This version covers {COVERED_COUNTRIES_EN}
      </p>
    </>
  );
}

function CellDetail({ row, place, cells, small }: { row: AoiRow; place: string; cells: number; small: boolean }) {
  const computed = row.source !== "observed";
  const lines = [
    computed
      ? `${fmtCount(row.value, true)} points · ${SOURCE_LABEL_EN[row.source]} · Uncertainty interval ${fmtCount(row.p_lo)}–${fmtCount(row.p_hi)}`
      : `${fmtCount(row.value)} points · ${SOURCE_LABEL_EN[row.source]}`,
    `Normal for this month (2013–2024): ${row.clim_median == null ? "–" : `${fmtCount(row.clim_median)} points`}`,
    row.pct_vs_ref == null
      ? "Compared to reference years: –"
      : `Higher than ${monthEn(row.month)} in other years by {Math.round(row.pct_vs_ref)}% of years${!small && isCritical(row) ? " → Critical month" : ""}`,
    `Raw MODIS: ${fmtCount(row.modis)} points`,
    `Measured VIIRS: ${computed ? "– (no VIIRS before Feb 2012)" : `${fmtCount(row.value)} points`}`,
  ];
  return (
    <div className="detail">
      <b>
        {monthEn(row.month)} {row.year} · {place} ({fmtCount(cells)} cells)
      </b>
      {"\n"}
      {lines.join("\n")}
    </div>
  );
}
