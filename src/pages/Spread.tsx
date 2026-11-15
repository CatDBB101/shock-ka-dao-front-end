import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDataSource } from "../lib/firecalendar";
import { addDays } from "../lib/firecalendar/time";
import { parseFirmsCsv, NRT_SOURCES } from "../lib/watch/risk";
import { FUEL_MODELS } from "../lib/spread/rothermel";
import type { GridGeo } from "../lib/spread/inputs";
import { ENSEMBLE_SPREAD } from "../lib/spread/simulate";
import { runSpread, type LonLat, type RunOutput } from "../lib/spread/run";

const SpreadMap = lazy(() => import("../components/spread/SpreadMap"));

const N = 201; // grid cells per side
const DURATIONS = [6, 12, 24, 48, 72] as const;
/** domain width (km) per forecast length — big enough for typical runs, small enough for ~1 s per member */
const DOMAIN_KM: Record<(typeof DURATIONS)[number], number> = { 6: 10, 12: 16, 24: 30, 48: 48, 72: 64 };
const MEMBER_OPTIONS = [1, 10, 25] as const;

const COMPASS_TH = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const compass = (deg: number) => COMPASS_TH[Math.round(((deg % 360) + 360) % 360 / 45) % 8]!;

type View = "prob" | "arrival";

type RunState = RunOutput & { terrain: boolean };

export default function Spread() {
  const ds = useDataSource();
  const [params] = useSearchParams();
  // /spread?lat=&lon= (link from a watchpoint) pre-places the ignition there
  const [ignition, setIgnition] = useState<[number, number] | null>(() => {
    const lat = Number(params.get("lat"));
    const lon = Number(params.get("lon"));
    return params.has("lat") && params.has("lon") && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lon, lat] : null;
  });
  const [fuelId, setFuelId] = useState("3");
  const [durationH, setDurationH] = useState<(typeof DURATIONS)[number]>(24);
  const [members, setMembers] = useState<(typeof MEMBER_OPTIONS)[number]>(25);
  const [liveMoist, setLiveMoist] = useState(90);
  const [useHotspots, setUseHotspots] = useState(() => ds.canDownloadHotspots && params.has("lat"));
  const [hotspots, setHotspots] = useState<[number, number][]>([]);
  const [view, setView] = useState<View>("prob");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RunState | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const domain: GridGeo | null = useMemo(
    () => (ignition ? { lon: ignition[0], lat: ignition[1], n: N, cell: (DOMAIN_KM[durationH] * 1000) / N } : null),
    [ignition, durationH],
  );

  const overlay = useMemo(() => (run ? { url: renderRaster(run, view), geo: run.geo } : null), [run, view]);

  async function start() {
    if (!domain || !ignition) return;
    setError(null);
    setRun(null);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      setBusy("Loading latest hotspots…");
      const hs = useHotspots && ds.canDownloadHotspots ? await latestHotspots(ds, domain).catch(() => [] as LonLat[]) : [];
      setHotspots(hs);
      const out = await runSpread(
        { ignition, fuelId, durationH, n: N, domainKm: DOMAIN_KM[durationH], members, liveMoisture: liveMoist / 100, hotspots: hs },
        setBusy,
        ac.signal,
      );
      setRun({ ...out, terrain: Boolean(out.elev) });
    } catch (e) {
      if (!ac.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const det = run?.result.deterministic;
  return (
    <>
      <h1>Fire spread forecast</h1>
      <p className="muted">
        Computed from surface fire physics (Rothermel) with wind, fuel moisture and the real terrain slope, then projected forward with the hourly weather forecast.
        The result is the probability that fire reaches each place, not an exact perimeter.
      </p>

      <div className="grid-2 spread-layout">
        <div className="panel stack">
          <Suspense fallback={<p role="status">Loading map…</p>}>
            <SpreadMap ignition={ignition} hotspots={hotspots} onPick={(p) => setIgnition(p)} overlay={overlay} domain={domain} />
          </Suspense>
          {run && (
            <div className="row" role="radiogroup" aria-label="Result view">
              <label className="field-inline">
                <input type="radio" name="view" checked={view === "prob"} onChange={() => setView("prob")} /> Probability of arrival
              </label>
              <label className="field-inline">
                <input type="radio" name="view" checked={view === "arrival"} onChange={() => setView("arrival")} /> Arrival time (main forecast)
              </label>
            </div>
          )}
          {run && <RasterLegend view={view} durationH={run.durationH} />}
        </div>

        <div className="panel stack">
          <h2>Settings</h2>
          <p className="small">
            Ignition:{" "}
            {ignition ? <span className="num">{ignition[1].toFixed(4)}, {ignition[0].toFixed(4)}</span> : <span className="muted">click the map</span>}
          </p>
          <label className="field">
            Fuel model (Anderson 13)
            <select id="spread-fuel" value={fuelId} onChange={(e) => setFuelId(e.target.value)}>
              {FUEL_MODELS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id}. {f.name}
                </option>
              ))}
            </select>
          </label>
          <p className="small muted">Suggested: Angolan savanna 1 or 3 · Argentine grassland 3 · Australian grassland 1 or 3 · Canadian boreal 10 · Californian chaparral 4</p>
          <div className="form-grid">
            <label className="field">
              Forecast length
              <select id="spread-dur" value={durationH} onChange={(e) => setDurationH(Number(e.target.value) as (typeof DURATIONS)[number])}>
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} h ({DOMAIN_KM[d]} km area)
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Ensemble members
              <select id="spread-members" value={members} onChange={(e) => setMembers(Number(e.target.value) as (typeof MEMBER_OPTIONS)[number])}>
                {MEMBER_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m === 1 ? "1 (main forecast only)" : m}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Live fuel moisture (%)
              <input id="spread-live" type="number" min={30} max={300} step={10} value={liveMoist} onChange={(e) => setLiveMoist(Number(e.target.value) || 90)} />
            </label>
          </div>
          <label className="field-inline">
            <input id="spread-hs" type="checkbox" checked={useHotspots} disabled={!ds.canDownloadHotspots} onChange={(e) => setUseHotspots(e.target.checked)} />
            Also start from the latest VIIRS hotspots in the area (NOAA-20/21, 24 h)
          </label>
          {!ds.canDownloadHotspots && <p className="small muted">Set VITE_FIRMS_MAP_KEY to use hotspots</p>}
          <button type="button" className="btn primary" disabled={!ignition || Boolean(busy)} onClick={() => void start()}>
            {busy ? "Working…" : "Run forecast"}
          </button>
          {busy && <p role="status" className="small">{busy}</p>}
          {error && (
            <p role="alert" className="error">
              Forecast failed: {error}
            </p>
          )}
        </div>
      </div>

      {run && det && (
        <section aria-labelledby="sp-res" className="stack">
          <h2 id="sp-res">{run.durationH}-hour forecast</h2>
          <div className="spread-stats">
            <div>
              <b className="num">{compass(det.hourly[0]?.headDeg ?? 0)}</b>
              <span>Initial head-fire direction ({Math.round(det.hourly[0]?.headDeg ?? 0)}°)</span>
            </div>
            <div>
              <b className="num">
                {fmtHa(run.result.burnedHa.p10)}–{fmtHa(run.result.burnedHa.p90)}
              </b>
              <span>Burned area (ha), 10–90% range of {run.result.members} members</span>
            </div>
            <div>
              <b className="num">{Math.max(...det.hourly.map((h) => h.rMax)).toFixed(1)}</b>
              <span>Peak head-fire rate (m/min)</span>
            </div>
            <div>
              <b className="num">{Math.max(...det.hourly.map((h) => h.flameM)).toFixed(1)}</b>
              <span>Peak flame length (m)</span>
            </div>
          </div>
          {run.result.reachedEdge && <p className="alert small">Some members reached the edge of the model area, so the real burned area may be larger</p>}
          {!run.terrain && <p className="alert small">Terrain could not be loaded, so this run assumes flat ground (no slope effect)</p>}
          {run.canopy ? (
            <p className="small">
              Canopy height data used (Meta/WRI, LiDAR-calibrated): mean height <span className="num">{run.canopy.meanHeightM.toFixed(1)}</span> m, cover{" "}
              <span className="num">{Math.round(run.canopy.meanCover * 100)}</span>%; sub-canopy wind and crown fire are included
            </p>
          ) : (
            <p className="small muted">No canopy height data here, so only surface fire is modelled</p>
          )}
          {run.hotspotsUsed > 0 && <p className="small">Started from the chosen point and {run.hotspotsUsed} VIIRS hotspot(s)</p>}

          <div className="table-scroll">
            <table className="fc-table">
              <caption className="sr-only">Hourly weather and fire behaviour at the ignition</caption>
              <thead>
                <tr>
                  <th>Time (UTC)</th>
                  <th>Wind at 10 m</th>
                  <th>Head fire heading</th>
                  <th>Rate of spread (m/min)</th>
                  <th>Flame length (m)</th>
                  <th>1-h fuel moisture</th>
                  {run.canopy && <th>Fire type at ignition</th>}
                </tr>
              </thead>
              <tbody>
                {det.hourly
                  .filter((_, i) => i % (run.durationH > 24 ? 6 : 3) === 0)
                  .map((h) => (
                    <tr key={h.hour}>
                      <td className="num">{run.forecast.weather[h.hour]?.time.slice(5, 16).replace("T", " ")}</td>
                      <td className="num">
                        {Math.round(h.windKmh)} km/h from {compass(h.windFromDeg)}
                      </td>
                      <td>
                        {compass(h.headDeg)} <span className="muted num">{Math.round(h.headDeg)}°</span>
                      </td>
                      <td className="num">{h.rMax.toFixed(1)}</td>
                      <td className="num">{h.flameM.toFixed(1)}</td>
                      <td className="num">{(h.d1 * 100).toFixed(1)}%</td>
                      {run.canopy && <td>{["Surface", "Passive crown (torching)", "Active crown"][h.crown]}</td>}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <Method />
        </section>
      )}
      {!run && <Method />}
    </>
  );
}

function Method() {
  return (
    <section aria-labelledby="sp-method" className="stack">
      <h2 id="sp-method">Method and limitations</h2>
      <ol className="steps">
        <li>
          <b>Rate of spread:</b> the Rothermel (1972) model as used in BehavePlus, FARSITE and FlamMap, from fuel load and particle size, moisture, midflame wind
          and slope, with spread capped at the wind speed (Andrews, Cruz &amp; Rothermel 2013).
        </li>
        <li>
          <b>Direction:</b> wind and slope effects are added as vectors to give the head-fire direction, then the Anderson (1983) ellipse gives the rate in every direction.
        </li>
        <li>
          <b>Dead fuel moisture:</b> from hourly temperature and humidity (Simard 1968 EMC), with 1-, 10- and 100-hour fuels responding at their own time lags.
        </li>
        <li>
          <b>Spread on the map:</b> arrival time at each cell by minimum travel time (the idea behind FlamMap MTT) on a {N}×{N} grid,
          with slope from AWS Terrain Tiles and weather from Open-Meteo.
        </li>
        <li>
          <b>Uncertainty:</b> the run is repeated with random wind-direction error of ±{ENSEMBLE_SPREAD.windDirSdDeg}° (standard deviation), wind speed ~{Math.round(ENSEMBLE_SPREAD.windSpeedLogSd * 100)}%
          and fuel moisture ±{ENSEMBLE_SPREAD.moistureSd * 100}%, because forecast wind-direction error is the main cause of wrong forecast perimeters.
        </li>
      </ol>
      <ul className="small muted">
        <li>Crown fire is modelled only where canopy height data exists (Van Wagner 1977, Rothermel 1991). Spotting is not included, so intense fires may spread faster than shown.</li>
        <li>One fuel model covers the whole area; there is no fuel map for Argentina or Angola yet. Only the sea is treated as a barrier.</li>
        <li>
          A review of 28 studies found a median error of about 57% for Rothermel against real fires. Use this for planning and early warning, not in place of incident command.
        </li>
        <li>
          This project's research found the 12-hour spread direction from satellite data within ±45° of the predicted direction 39.3% of the time (25% by chance). Details on the <Link to="/evidence">Evidence</Link> page.
        </li>
      </ul>
    </section>
  );
}

function RasterLegend({ view, durationH }: { view: View; durationH: number }) {
  const stops = view === "prob" ? PROB_STOPS.map((s) => [s.c, `${Math.round(s.p * 100)}%`] as const) : ARRIVAL_STOPS.map((c, i) => [c, `≤${Math.round(((i + 1) * durationH) / ARRIVAL_STOPS.length)} h`] as const);
  return (
    <div className="fc-legend" aria-label="Result legend">
      {stops.map(([c, l]) => (
        <span key={l}>
          <i className="fc-swatch" style={{ background: `rgb(${c.join(",")})` }} aria-hidden="true" />
          {l}
        </span>
      ))}
    </div>
  );
}

const fmtHa = (ha: number) => Math.round(ha).toLocaleString("en-US");

const PROB_STOPS: { p: number; c: [number, number, number] }[] = [
  { p: 0.05, c: [255, 230, 120] },
  { p: 0.25, c: [253, 174, 60] },
  { p: 0.5, c: [240, 100, 30] },
  { p: 0.75, c: [200, 40, 20] },
  { p: 0.95, c: [120, 10, 30] },
];
const ARRIVAL_STOPS: [number, number, number][] = [
  [120, 10, 30],
  [190, 30, 25],
  [235, 85, 30],
  [250, 150, 50],
  [255, 205, 90],
  [255, 240, 160],
];

function renderRaster(run: RunState, view: View): string {
  const { n } = run.geo;
  const c = document.createElement("canvas");
  c.width = n;
  c.height = n;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(n, n);
  const T = run.durationH * 60;
  const { probability, deterministic } = run.result;
  for (let i = 0; i < n * n; i++) {
    let rgb: [number, number, number] | null = null;
    if (view === "prob") {
      const p = probability[i]!;
      for (const s of PROB_STOPS) if (p >= s.p) rgb = s.c;
    } else {
      const t = deterministic.arrival[i]!;
      if (t <= T) rgb = ARRIVAL_STOPS[Math.min(ARRIVAL_STOPS.length - 1, Math.floor((t / T) * ARRIVAL_STOPS.length))]!;
    }
    if (rgb) {
      img.data[i * 4] = rgb[0];
      img.data[i * 4 + 1] = rgb[1];
      img.data[i * 4 + 2] = rgb[2];
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

/** VIIRS NRT detections from the last 24 h inside the simulation domain. */
async function latestHotspots(ds: ReturnType<typeof useDataSource>, g: GridGeo): Promise<LonLat[]> {
  const km = (g.n * g.cell) / 2000;
  const dLat = km / 110.54;
  const dLon = km / (111.32 * Math.cos((g.lat * Math.PI) / 180));
  const box = { minLat: g.lat - dLat, maxLat: g.lat + dLat, minLon: g.lon - dLon, maxLon: g.lon + dLon };
  const end = new Date().toISOString().slice(0, 10);
  const parts = await Promise.allSettled(NRT_SOURCES.map((s) => ds.downloadHotspotsCsv(box, addDays(end, -1), end, s)));
  const since = Date.now() - 24 * 3_600_000;
  return parts
    .flatMap((p) => (p.status === "fulfilled" ? parseFirmsCsv(p.value) : []))
    .filter((h) => h.confidence !== "l" && Date.parse(h.time) >= since)
    .map((h) => [h.lon, h.lat] as [number, number]);
}
