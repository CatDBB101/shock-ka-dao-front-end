// Firefighter mode: admin-defined watchpoints, subscribe by email, current status per point.
import { lazy, Suspense, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  errorMessageTh,
  fmtCount,
  hexagonRing,
  hexToParam,
  monthTh,
  MONTHS_TH,
  ringBox,
  useAoiCalendar,
  useDataSource,
  useMeta,
} from "../lib/firecalendar";
import { LoadError, regionTh } from "../components/firecalendar";
import { normEmail, validateEmail } from "../lib/watch/alerts";
import { alertService, useRecentHotspots, useStoredEmail, useSubscriptions, useWatchpoints } from "../lib/watch/hooks";
import { ACTIVE_HOURS, assessWatchpoint, LEVEL_ORDER, LEVEL_TH, type WatchStatus } from "../lib/watch/risk";
import type { Watchpoint } from "../lib/watch/types";

const WatchMap = lazy(() => import("../components/watch/WatchMap"));

type Filter = "all" | "mine";

export default function Watch() {
  const ds = useDataSource();
  const meta = useMeta();
  const wps = useWatchpoints();
  const [email, setEmail] = useStoredEmail();
  const subs = useSubscriptions(email);
  const [filter, setFilter] = useState<Filter>(email ? "mine" : "all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [month] = useState(() => new Date().getUTCMonth() + 1);
  const svc = alertService();

  const points = useMemo(() => wps.data ?? [], [wps.data]);
  const subscribed = useMemo(() => new Set((subs.data ?? []).map((s) => s.watchpointId)), [subs.data]);
  // NRT checks only for subscribed points + the selected one (FIRMS rate limits per key)
  const checkList = useMemo(() => points.filter((w) => subscribed.has(w.id) || w.id === selectedId), [points, subscribed, selectedId]);
  const nrt = useRecentHotspots(checkList);

  const rows = useMemo(() => {
    const out = points.map((wp) => {
      const n = nrt.byId.get(wp.id);
      const status = assessWatchpoint({ month, season: wp.region ? meta.data?.season[wp.region] : undefined, near: n?.data ?? null, outsideCoverage: wp.region === null });
      return { wp, status, subscribed: subscribed.has(wp.id), nrtLoading: n?.loading ?? false, nrtError: n?.error ?? null };
    });
    return out.sort((a, b) => Number(b.subscribed) - Number(a.subscribed) || LEVEL_ORDER[b.status.level] - LEVEL_ORDER[a.status.level] || a.wp.name.localeCompare(b.wp.name, "th"));
  }, [points, nrt, meta.data, month, subscribed]);

  const shown = filter === "mine" ? rows.filter((r) => r.subscribed) : rows;
  const selected = rows.find((r) => r.wp.id === selectedId) ?? null;
  const activeMine = rows.filter((r) => r.subscribed && r.status.level === "active");
  const mapPoints = useMemo(() => rows.map((r) => ({ ...r.wp, level: r.status.level, subscribed: r.subscribed })), [rows]);
  const mapHotspots = useMemo(() => rows.flatMap((r) => r.status.hotspots ?? []), [rows]);

  return (
    <>
      <h1>Watchpoints</h1>
      <p className="muted">
        Follow the watchpoints set up by your administrator. When a satellite detects a hotspot within the radius, or the fire season peaks, you get an email alert.
      </p>

      <div className="stack" style={{ marginBottom: 16 }}>
        <p className="small muted">
          Watchpoint source:{" "}
          {svc.watchpointSource === "backend" ? "backend (GET /watchpoint)" : svc.watchpointSource === "alerts" ? "alert service (GET /v1/watchpoints)" : "bundled example file (no backend connected; set VITE_FC_BACKEND_API)"}
        </p>
        {!svc.sendsEmail && (
          <p className="note small">
            <b>Demo mode:</b> follows are saved in this browser only and no email is sent. Connect the alert service first (set <code>VITE_FC_ALERTS_API</code>, see ADR-016).
          </p>
        )}
        {!ds.canDownloadHotspots && (
          <p className="note small">
            Latest hotspots can't be checked because <code>VITE_FIRMS_MAP_KEY</code> is not set, so only the seasonal level is shown.
          </p>
        )}
        {activeMine.length > 0 && (
          <div className="alert" role="alert">
            <b>Hotspots at {activeMine.length} of your watchpoints:</b> {activeMine.map((r) => r.wp.name).join(", ")}
          </div>
        )}
      </div>

      <section className="panel stack" aria-labelledby="ff-email">
        <h2 id="ff-email" style={{ margin: 0, fontSize: 18 }}>
          Alert email
        </h2>
        <EmailForm email={email} onSave={(e) => { setEmail(e); if (e) setFilter("mine"); }} />
      </section>

      <section className="panel stack" aria-label="Watchpoint map" style={{ marginTop: 16 }}>
        <Suspense fallback={<div className="aoi-map-wrap"><div className="aoi-map" /><p className="aoi-map-hint" role="status">Loading map…</p></div>}>
          <WatchMap points={mapPoints} hotspots={mapHotspots} selectedId={selectedId} onSelect={setSelectedId} />
        </Suspense>
        <LevelLegend />
      </section>

      <section style={{ marginTop: 24 }} aria-labelledby="ff-list">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 id="ff-list" style={{ margin: 0 }}>
            All watchpoints
          </h2>
          <div className="tabs" role="group" aria-label="Filter">
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
              All ({rows.length})
            </button>
            <button type="button" aria-pressed={filter === "mine"} onClick={() => setFilter("mine")} disabled={!email}>
              Following ({subscribed.size})
            </button>
          </div>
        </div>

        {wps.isPending && <p role="status">Loading watchpoints…</p>}
        {wps.isError && <LoadError error={wps.error} onRetry={() => void wps.refetch()} />}
        {subs.toggle.isError && (
          <p className="error" role="alert">
            {errorMessageTh(subs.toggle.error)}: {subs.toggle.error.message}
          </p>
        )}
        {wps.data && shown.length === 0 && (
          <p className="muted" style={{ marginTop: 12 }}>
            {filter === "mine" ? "You aren't following any watchpoints yet. Choose Follow on a watchpoint in the All tab" : "No watchpoints yet"}
          </p>
        )}

        <div className="grid-2" style={{ marginTop: 12 }}>
          <ul className="ff-list" aria-label="Watchpoints">
            {shown.map((r) => (
              <li key={r.wp.id}>
                <WatchCard
                  wp={r.wp}
                  status={r.status}
                  subscribed={r.subscribed}
                  nrtLoading={r.nrtLoading}
                  nrtError={r.nrtError ? errorMessageTh(r.nrtError) : null}
                  selected={r.wp.id === selectedId}
                  canSubscribe={Boolean(email)}
                  busy={subs.toggle.isPending && subs.toggle.variables?.id === r.wp.id}
                  onSelect={() => setSelectedId(r.wp.id)}
                  onToggle={() => subs.toggle.mutate({ id: r.wp.id, on: !r.subscribed })}
                />
              </li>
            ))}
          </ul>
          <div className="panel" aria-live="polite" style={{ alignSelf: "start" }}>
            {selected ? <WatchDetail wp={selected.wp} status={selected.status} month={month} /> : <p className="small muted">Select a watchpoint on the map or in the list to see details</p>}
          </div>
        </div>
      </section>

      <section className="panel small" style={{ marginTop: 24 }} aria-labelledby="ff-how">
        <h3 id="ff-how" style={{ marginTop: 0 }}>
          How levels are decided
        </h3>
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          <li>
            <b>{LEVEL_TH.active}</b>: VIIRS (NOAA-20, NOAA-21 near real time) detected a hotspot within the radius in the last {ACTIVE_HOURS} h, excluding low-confidence detections
          </li>
          <li>
            <b>{LEVEL_TH.high}</b>: this month is within ±1 month of the regional fire-season peak
          </li>
          <li>
            <b>{LEVEL_TH.elevated}</b>: this month is inside the fire season (10–90% of the year's cumulative detections)
          </li>
          <li>Seasonal levels come from 2001–2024 statistics, not a probability of fire. Satellite hotspots can be planned burns; confirm on the ground.</li>
        </ul>
      </section>
    </>
  );
}

function EmailForm({ email, onSave }: { email: string; onSave: (e: string) => void }) {
  const [draft, setDraft] = useState(email);
  const [err, setErr] = useState<string | null>(null);
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    try {
      onSave(validateEmail(draft));
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };
  if (email && normEmail(draft) === normEmail(email))
    return (
      <div className="row">
        <span>
          Alerts go to <b>{email}</b>
        </span>
        <button type="button" className="btn ghost" onClick={() => { setDraft(""); onSave(""); }}>
          Change email
        </button>
      </div>
    );
  return (
    <form className="row" onSubmit={submit} noValidate>
      <label className="field" style={{ flex: "1 1 240px" }}>
        Email
        <input type="email" autoComplete="email" inputMode="email" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="name@example.org" />
      </label>
      <button className="btn primary" type="submit" style={{ alignSelf: "end" }}>
        Use this email
      </button>
      {err && (
        <span className="error" role="alert">
          {err}
        </span>
      )}
    </form>
  );
}

function LevelBadge({ level }: { level: WatchStatus["level"] }) {
  return <span className={`ff-badge lvl-${level}`}>{LEVEL_TH[level]}</span>;
}

function LevelLegend() {
  return (
    <div className="fc-legend" aria-label="Level legend">
      {(["active", "high", "elevated", "normal"] as const).map((l) => (
        <span key={l}>
          <LevelBadge level={l} />
        </span>
      ))}
      <span>Thick outline = following · small red dots = latest hotspots</span>
    </div>
  );
}

function WatchCard(p: {
  wp: Watchpoint;
  status: WatchStatus;
  subscribed: boolean;
  nrtLoading: boolean;
  nrtError: string | null;
  selected: boolean;
  canSubscribe: boolean;
  busy: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <article className={`ff-card lvl-${p.status.level}${p.selected ? " selected" : ""}`} aria-label={`${p.wp.name}: ${LEVEL_TH[p.status.level]}`}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17 }}>{p.wp.name}</h3>
          <p className="small muted" style={{ margin: "2px 0 0" }}>
            {p.wp.area}{p.wp.region ? ` · ${regionTh(p.wp.region)}` : ""} · radius {p.wp.radiusKm} km
          </p>
        </div>
        <LevelBadge level={p.status.level} />
      </div>
      <ul className="small" style={{ paddingLeft: 18, margin: "8px 0" }}>
        {p.status.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
        {p.nrtLoading && <li className="muted">Checking latest hotspots…</li>}
        {p.nrtError && <li className="error">Could not check latest hotspots ({p.nrtError})</li>}
        {!p.subscribed && !p.selected && p.status.hotspots == null && <li className="muted">Follow or select this watchpoint to check the latest hotspots</li>}
      </ul>
      <div className="row">
        <button
          type="button"
          className={`btn${p.subscribed ? " ghost" : " primary"}`}
          aria-pressed={p.subscribed}
          disabled={!p.canSubscribe || p.busy}
          title={p.canSubscribe ? undefined : "Enter your email first"}
          onClick={p.onToggle}
        >
          {p.busy ? "Saving…" : p.subscribed ? "Following · unfollow" : "Follow"}
        </button>
        <button type="button" className="btn ghost" aria-pressed={p.selected} onClick={p.onSelect}>
          Details
        </button>
      </div>
    </article>
  );
}

function WatchDetail({ wp, status, month }: { wp: Watchpoint; status: WatchStatus; month: number }) {
  const hex = { lat: wp.lat, lon: wp.lon, radiusKm: wp.radiusKm };
  const ring = useMemo(() => hexagonRing(hex), [wp.lat, wp.lon, wp.radiusKm]); // eslint-disable-line react-hooks/exhaustive-deps
  const box = useMemo(() => ringBox(ring), [ring]);
  const covered = wp.region !== null;
  const hist = useAoiCalendar(covered ? box : null, "2013-01", "2024-12", ring);

  // typical (median) fire count per calendar month, 2013–2024, VIIRS-measured
  const clim = useMemo(() => {
    if (!hist.data) return null;
    const by = new Map<number, number>();
    for (const r of hist.data.rows) if (r.clim_median != null) by.set(r.month, r.clim_median);
    return Array.from({ length: 12 }, (_, i) => by.get(i + 1) ?? 0);
  }, [hist.data]);
  const maxClim = clim ? Math.max(1, ...clim) : 1;
  const hs = (status.hotspots ?? []).slice().sort((a, b) => b.time.localeCompare(a.time));

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>{wp.name}</h3>
        <LevelBadge level={status.level} />
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {wp.area} · <span className="num">{wp.lat.toFixed(2)}, {wp.lon.toFixed(2)}</span> · radius {wp.radiusKm} km
        {wp.note ? ` · ${wp.note}` : ""}
      </p>

      <div>
        <h4 style={{ margin: "8px 0 4px" }}>Latest hotspots ({ACTIVE_HOURS} h)</h4>
        {status.hotspots == null ? (
          <p className="small muted">Not checked yet</p>
        ) : hs.length === 0 ? (
          <p className="small">No hotspots within the radius</p>
        ) : (
          <div className="table-scroll">
            <table className="fc-table small">
              <thead>
                <tr>
                  <th>Time (UTC)</th>
                  <th className="num">Latitude</th>
                  <th className="num">Longitude</th>
                  <th className="num">FRP (MW)</th>
                </tr>
              </thead>
              <tbody>
                {hs.slice(0, 10).map((h, i) => (
                  <tr key={i}>
                    <td className="num">{h.time.slice(0, 16).replace("T", " ")}</td>
                    <td className="num">{h.lat.toFixed(3)}</td>
                    <td className="num">{h.lon.toFixed(3)}</td>
                    <td className="num">{h.frp.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hs.length > 10 && <p className="small muted">and {hs.length - 10} more</p>}
          </div>
        )}
      </div>

      <div>
        <h4 style={{ margin: "8px 0 4px" }}>Seasonal fire here (median 2013–2024)</h4>
        {!covered && <p className="small muted">No history: this watchpoint is outside the 6 countries the FireCalendar+ calendar covers. Satellite hotspots are still checked as usual.</p>}
        {covered && hist.isPending && <p className="small muted" role="status">Calculating… the first run takes a moment</p>}
        {hist.isError && <LoadError error={hist.error} onRetry={() => void hist.refetch()} />}
        {clim && (
          <>
            <div className="ff-bars" role="img" aria-label={`Typical monthly detections: ${clim.map((v, i) => `${MONTHS_TH[i]} ${Math.round(v)}`).join(", ")}`}>
              {clim.map((v, i) => (
                <div key={i} className={`ff-bar${i + 1 === month ? " now" : ""}`}>
                  <i style={{ height: `${Math.max(2, (v / maxClim) * 100)}%` }} />
                  <span>{MONTHS_TH[i]}</span>
                </div>
              ))}
            </div>
            <p className="small">
              A typical {monthTh(month)} has about <b className="num">{fmtCount(clim[month - 1] ?? 0)}</b> detections in this area ({fmtCount(hist.data?.cells ?? 0)} H3 cells)
            </p>
          </>
        )}
      </div>

      <div className="row">
        <Link className="btn" to={`/spread?lat=${wp.lat.toFixed(4)}&lon=${wp.lon.toFixed(4)}`}>
          Forecast fire spread from here →
        </Link>
        {covered && (
          <Link className="btn ghost" to={`/explore?hex=${hexToParam(hex)}`}>
            See 24 years of history (switches to Scientist) →
          </Link>
        )}
      </div>
    </div>
  );
}
