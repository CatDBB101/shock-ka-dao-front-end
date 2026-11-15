// Simulator mode: set up a fire scenario (ignition, fuel, weather, firebreaks) and play it back in 3D.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FUEL_MODELS } from "../lib/spread/rothermel";
import type { GridGeo } from "../lib/spread/inputs";
import { burnedHaAt } from "../lib/spread/playback";
import { runSpread, suggestDomain, type LonLat, type RunOutput, type WeatherOverride } from "../lib/spread/run";
import { BURN_BANDS, FLAME_STOPS, flameVertical, TREE_COLOUR, treeVertical, type SimFrameRun } from "../components/simulator/legend";
import { CANOPY_DEFAULTS } from "../lib/spread/crown";

const Sim3DMap = lazy(() => import("../components/simulator/Sim3DMap"));

const N = 201;
const DURATIONS = [6, 12, 24, 48] as const;
const DOMAIN_KM: Record<(typeof DURATIONS)[number], number> = { 6: 10, 12: 16, 24: 30, 48: 48 };
/** simulated hours per real second */
const SPEEDS = [0.5, 1, 3, 6] as const;

const COMPASS_TH = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const compass = (deg: number) => COMPASS_TH[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;
const fmtHM = (min: number) => `${Math.floor(min / 60)}:${String(Math.floor(min % 60)).padStart(2, "0")}`;
const fmtHa = (ha: number) => Math.round(ha).toLocaleString("en-US");

type Tool = "ignite" | "break";

export default function Simulator() {
  const [tool, setTool] = useState<Tool>("ignite");
  const [params] = useSearchParams();
  // /simulator?lat=&lon= pre-places the ignition (and centres the 3D view there)
  const [ignition, setIgnition] = useState<LonLat | null>(() => {
    const lat = Number(params.get("lat"));
    const lon = Number(params.get("lon"));
    return params.has("lat") && params.has("lon") && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lon, lat] : null;
  });
  const [firebreaks, setFirebreaks] = useState<LonLat[][]>([]);
  const [draft, setDraft] = useState<LonLat[]>([]);
  const [fuelId, setFuelId] = useState("3");
  const [durationH, setDurationH] = useState<(typeof DURATIONS)[number]>(12);
  const [weatherMode, setWeatherMode] = useState<"forecast" | "manual">("manual");
  const [manual, setManual] = useState<WeatherOverride>({ windKmh: 25, windFromDeg: 225, tempC: 32, rh: 20 });
  const [exaggeration, setExaggeration] = useState(1.5);
  const [useCanopy, setUseCanopy] = useState(true);
  const [showTrees, setShowTrees] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RunOutput | null>(null);
  const [tMin, setTMin] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const durationMin = (run?.durationH ?? durationH) * 60;
  // manual weather: size and centre the grid on the expected fire; forecast: fixed size around the ignition
  const plan = useMemo(() => {
    if (!ignition) return null;
    return weatherMode === "manual" ? suggestDomain(fuelId, manual, durationH, ignition) : { center: ignition, domainKm: DOMAIN_KM[durationH] };
  }, [ignition, weatherMode, fuelId, manual, durationH]);
  const domain: GridGeo | null = useMemo(
    () => (plan ? { lon: plan.center[0], lat: plan.center[1], n: N, cell: (plan.domainKm * 1000) / N } : null),
    [plan],
  );
  const frameRun: SimFrameRun | null = useMemo(
    () =>
      run
        ? {
            geo: run.geo,
            arrival: run.result.deterministic.arrival,
            durationMin: run.durationH * 60,
            hourly: run.result.deterministic.hourly,
            canopy: run.canopy ? { height: run.canopy.height, cover: run.canopy.cover } : null,
            crown: run.result.deterministic.crown,
          }
        : null,
    [run],
  );

  // playback clock
  useEffect(() => {
    if (!playing || !run) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTMin((t) => {
        const next = t + dt * speed * 60;
        if (next >= durationMin) {
          setPlaying(false);
          return durationMin;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, run, durationMin]);

  // quantise the frame time so the map redraws ~every simulated 5 minutes, not every animation frame
  const frameT = Math.round(tMin / 5) * 5;

  const onPick = (p: LonLat) => {
    if (tool === "ignite") setIgnition(p);
    else setDraft((d) => [...d, p]);
  };
  const finishLine = () => {
    if (draft.length > 1) setFirebreaks((f) => [...f, draft]);
    setDraft([]);
  };

  async function start() {
    if (!ignition || !plan) return;
    const breaks = draft.length > 1 ? [...firebreaks, draft] : firebreaks;
    if (draft.length) {
      setFirebreaks(breaks);
      setDraft([]);
    }
    setError(null);
    setPlaying(false);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const out = await runSpread(
        {
          ignition,
          center: plan.center,
          fuelId,
          durationH,
          n: N,
          domainKm: plan.domainKm,
          members: 1,
          liveMoisture: 0.9,
          firebreaks: breaks,
          weather: weatherMode === "manual" ? manual : null,
          useCanopy,
        },
        setBusy,
        ac.signal,
      );
      setRun(out);
      setTMin(0);
      setPlaying(true);
    } catch (e) {
      if (!ac.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const det = run?.result.deterministic;
  const hour = det?.hourly[Math.min(det.hourly.length - 1, Math.floor(frameT / 60))];
  const w = run?.forecast.weather[Math.min(run.forecast.weather.length - 1, Math.floor(frameT / 60))];
  const burned = run && det ? burnedHaAt(det.arrival, frameT, run.geo.cell) : 0;
  // area that burned as crown fire up to now (passive + active)
  const crownHa = useMemo(() => {
    if (!run || !det?.crown) return null;
    let k = 0;
    for (let i = 0; i < det.arrival.length; i++) if (det.arrival[i]! <= frameT && det.crown[i]! > 0) k++;
    return (k * run.geo.cell * run.geo.cell) / 10_000;
  }, [run, det, frameT]);

  return (
    <>
      <h1>3D fire simulator</h1>
      <p className="muted">
        Set up a scenario and watch the fire spread over real terrain in 3D. It uses the same physics as the spread forecast (Rothermel with wind, slope and fuel moisture).
        Change the wind or draw a firebreak, then compare the outcome.
      </p>

      <div className="grid-2 spread-layout">
        <div className="panel stack">
          <Suspense fallback={<p role="status">Loading 3D map…</p>}>
            <Sim3DMap
              tool={tool}
              ignition={ignition}
              firebreaks={firebreaks}
              draft={draft}
              onPick={onPick}
              domain={domain}
              run={frameRun}
              tMin={frameT}
              exaggeration={exaggeration}
              showTrees={showTrees}
            />
          </Suspense>

          {run && det && (
            <div className="sim-player stack">
              <div className="row">
                <button type="button" className="btn primary" onClick={() => (tMin >= durationMin ? (setTMin(0), setPlaying(true)) : setPlaying((x) => !x))}>
                  {playing ? "Pause" : tMin >= durationMin ? "Replay" : "Play"}
                </button>
                <label className="field-inline sim-time">
                  <span className="sr-only">Simulation time</span>
                  <input
                    id="sim-t"
                    type="range"
                    min={0}
                    max={durationMin}
                    step={5}
                    value={frameT}
                    onChange={(e) => {
                      setPlaying(false);
                      setTMin(Number(e.target.value));
                    }}
                  />
                </label>
                <b className="num" aria-live="off">
                  +{fmtHM(frameT)} h
                </b>
                <label className="field-inline">
                  Speed
                  <select id="sim-speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value) as (typeof SPEEDS)[number])}>
                    {SPEEDS.map((s) => (
                      <option key={s} value={s}>
                        {s} h per second
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="spread-stats sim-stats">
                <div>
                  <b className="num">{fmtHa(burned)}</b>
                  <span>Burned so far (ha)</span>
                </div>
                <div>
                  <b>{hour ? compass(hour.headDeg) : "–"}</b>
                  <span>Head fire heading</span>
                </div>
                <div>
                  <b className="num">{hour ? hour.rMax.toFixed(1) : "–"}</b>
                  <span>Head-fire rate (m/min)</span>
                </div>
                <div>
                  <b className="num">{hour ? hour.flameM.toFixed(1) : "–"}</b>
                  <span>Head-fire flame (m)</span>
                </div>
                {crownHa != null && (
                  <div>
                    <b className="num">{fmtHa(crownHa)}</b>
                    <span>Burned as crown fire (ha)</span>
                  </div>
                )}
                <div>
                  <b className="num">{w ? `${Math.round(w.windKmh)}` : "–"}</b>
                  <span>Wind km/h {w ? `from ${compass(w.windFromDeg)}` : ""}</span>
                </div>
              </div>
              {det.reachedEdge && <p className="alert small">The fire reached the edge of the model area, so the real burned area may be larger</p>}
              {!run.elev && <p className="alert small">Terrain could not be loaded, so this run assumes flat ground</p>}
              <CanopyNote run={run} wanted={useCanopy} />
              <SimLegend durationH={run.durationH} vert={flameVertical(run.geo.cell)} treeVert={run.canopy ? treeVertical(run.geo.cell) : null} />
            </div>
          )}
        </div>

        <div className="panel stack">
          <h2>Scenario</h2>
          <div className="row" role="radiogroup" aria-label="Map tool">
            <label className="field-inline">
              <input type="radio" name="sim-tool" checked={tool === "ignite"} onChange={() => setTool("ignite")} /> Place ignition
            </label>
            <label className="field-inline">
              <input type="radio" name="sim-tool" checked={tool === "break"} onChange={() => setTool("break")} /> Draw firebreak
            </label>
          </div>
          <p className="small">
            Ignition: {ignition ? <span className="num">{ignition[1].toFixed(4)}, {ignition[0].toFixed(4)}</span> : <span className="muted">not placed</span>}
          </p>
          {tool === "break" && (
            <div className="stack">
              <p className="small muted">Click point by point to draw a firebreak (road, dozer line, river). Fire cannot cross it; it is about two grid cells wide.</p>
              <div className="row">
                <button type="button" className="btn" disabled={draft.length < 2} onClick={finishLine}>
                  Finish line ({draft.length} points)
                </button>
                <button type="button" className="btn ghost" disabled={!firebreaks.length && !draft.length} onClick={() => (setFirebreaks([]), setDraft([]))}>
                  Clear firebreaks
                </button>
              </div>
            </div>
          )}
          {firebreaks.length > 0 && <p className="small">{firebreaks.length} firebreak line(s)</p>}

          <label className="field">
            Fuel model
            <select id="sim-fuel" value={fuelId} onChange={(e) => setFuelId(e.target.value)}>
              {FUEL_MODELS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id}. {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Duration
            <select id="sim-dur" value={durationH} onChange={(e) => setDurationH(Number(e.target.value) as (typeof DURATIONS)[number])}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} h
                </option>
              ))}
            </select>
          </label>

          {plan && (
            <p className="small muted">
              Model area <span className="num">{plan.domainKm}</span> × <span className="num">{plan.domainKm}</span> km (cells of{" "}
              <span className="num">{Math.round((plan.domainKm * 1000) / N)}</span> m){weatherMode === "manual" ? ", sized to the expected spread" : ""}
            </p>
          )}
          <fieldset className="stack sim-weather">
            <legend>Weather</legend>
            <div className="row">
              <label className="field-inline">
                <input type="radio" name="sim-wx" checked={weatherMode === "manual"} onChange={() => setWeatherMode("manual")} /> Manual (constant)
              </label>
              <label className="field-inline">
                <input type="radio" name="sim-wx" checked={weatherMode === "forecast"} onChange={() => setWeatherMode("forecast")} /> Live forecast (Open-Meteo)
              </label>
            </div>
            {weatherMode === "manual" && (
              <>
                <Slider id="sim-wind" label="Wind speed at 10 m" unit="km/h" min={0} max={80} value={manual.windKmh} onChange={(v) => setManual({ ...manual, windKmh: v })} />
                <Slider
                  id="sim-dir"
                  label={`Wind from ${compass(manual.windFromDeg)}`}
                  unit="°"
                  min={0}
                  max={355}
                  step={5}
                  value={manual.windFromDeg}
                  onChange={(v) => setManual({ ...manual, windFromDeg: v })}
                />
                <Slider id="sim-temp" label="Temperature" unit="°C" min={0} max={45} value={manual.tempC} onChange={(v) => setManual({ ...manual, tempC: v })} />
                <Slider id="sim-rh" label="Relative humidity" unit="%" min={5} max={100} value={manual.rh} onChange={(v) => setManual({ ...manual, rh: v })} />
              </>
            )}
          </fieldset>

          <label className="field-inline">
            <input id="sim-canopy" type="checkbox" checked={useCanopy} onChange={(e) => setUseCanopy(e.target.checked)} />
            Use canopy height data (LiDAR-calibrated CHM) for sub-canopy wind and crown fire
          </label>
          <label className="field-inline">
            <input id="sim-trees" type="checkbox" checked={showTrees} onChange={(e) => setShowTrees(e.target.checked)} />
            Show 3D trees
          </label>
          <Slider id="sim-exag" label="Terrain exaggeration" unit="×" min={1} max={3} step={0.5} value={exaggeration} onChange={setExaggeration} />

          <button type="button" className="btn primary" disabled={!ignition || Boolean(busy)} onClick={() => void start()}>
            {busy ? "Working…" : run ? "Run again" : "Run simulation"}
          </button>
          {busy && <p role="status" className="small">{busy}</p>}
          {error && (
            <p role="alert" className="error">
              Simulation failed: {error}
            </p>
          )}
          <p className="small muted">
            Results are a what-if scenario with one fuel model for the whole area and no spotting. For a forecast from real weather with uncertainty, use the
            <Link to="/spread"> spread forecast</Link> in Firefighter mode.
          </p>
        </div>
      </div>
    </>
  );
}

function Slider(p: { id: string; label: string; unit: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="field sim-slider" htmlFor={p.id}>
      <span>
        {p.label}: <b className="num">{p.value}</b> {p.unit}
      </span>
      <input id={p.id} type="range" min={p.min} max={p.max} step={p.step ?? 1} value={p.value} onChange={(e) => p.onChange(Number(e.target.value))} />
    </label>
  );
}

function CanopyNote({ run, wanted }: { run: RunOutput; wanted: boolean }) {
  if (!wanted) return <p className="small muted">Canopy data was not used in this run</p>;
  const c = run.canopy;
  if (!c)
    return (
      <p className="note small">
        No canopy height data for this area, so canopy and crown-fire effects are left out. Data currently exists around the 9 watchpoints.
        Add an area with <code>node scripts/canopy/build-canopy.mjs lat,lon</code>
      </p>
    );
  return (
    <p className="small">
      <b>Canopy:</b> covers {Math.round(c.coverage * 100)}% of the model area · mean height <span className="num">{c.meanHeightM.toFixed(1)}</span> m · mean cover{" "}
      <span className="num">{Math.round(c.meanCover * 100)}</span>% · fire-relevant forest {Math.round(c.forestShare * 100)}%
      <br />
      <span className="muted">
        Source: {c.index.dataset} ({c.index.license}), a LiDAR-calibrated canopy height model, not a raw point cloud · height above ground · canopy base height
        ({Math.round(CANOPY_DEFAULTS.cbhRatio * 100)}% of height) and canopy bulk density ({CANOPY_DEFAULTS.cbd} kg/m³) are assumed
      </span>
    </p>
  );
}

function SimLegend({ durationH, vert, treeVert }: { durationH: number; vert: number; treeVert: number | null }) {
  return (
    <div className="stack small">
      <div className="fc-legend" aria-label="Burned area by time">
        <span className="muted">Burned by:</span>
        {BURN_BANDS.map((c, i) => (
          <span key={i}>
            <i className="fc-swatch" style={{ background: `rgb(${c.join(",")})` }} aria-hidden="true" />≤{Math.round(((i + 1) * durationH) / BURN_BANDS.length)} h
          </span>
        ))}
      </div>
      <div className="fc-legend" aria-label="Flame colours">
        <span className="muted">Flames (columns exaggerated ×{vert}):</span>
        {FLAME_STOPS.map(([m, c]) => (
          <span key={m}>
            <i className="fc-swatch" style={{ background: c }} aria-hidden="true" />
            {m} m
          </span>
        ))}
        <span>
          <i className="fc-swatch" style={{ background: "#4cc9f0" }} aria-hidden="true" />
          Firebreak
        </span>
        {treeVert != null && (
          <>
            <span>
              <i className="fc-swatch" style={{ background: TREE_COLOUR.live }} aria-hidden="true" />
              Trees (exaggerated ×{treeVert})
            </span>
            <span>
              <i className="fc-swatch" style={{ background: TREE_COLOUR.burned }} aria-hidden="true" />
              Burned (crown fire leaves half-height snags)
            </span>
          </>
        )}
      </div>
    </div>
  );
}
