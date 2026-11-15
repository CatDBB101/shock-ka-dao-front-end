import { Link } from "react-router-dom";
import { REGIONS, useMeta, useRegionCalendar, type Region } from "../lib/firecalendar";
import { ContinuityChart, LoadError, regionEn } from "../components/firecalendar";
import { EvidenceGallery } from "./evidence/EvidenceGallery";

// Source: model_card.json · final test set 622,200 rows (switch to /v1/meta/eval when it exists)
const SCORES: { region: string; dev: number; bias: number }[] = [
  { region: "Africa (Angola)", dev: 1.98, bias: -6.8 },
  { region: "South America (Argentina + Brazil)", dev: 1.33, bias: -2.3 },
  { region: "Canada + USA", dev: 0.81, bias: -10.6 },
  { region: "Australia", dev: 1.28, bias: 1.5 },
];
const DEV_MAX = 2.2;
const BIAS_MAX = 12;
const fmtBias = (b: number) => `${b > 0 ? "+" : b < 0 ? "−" : ""}${Math.abs(b).toFixed(1)}%`;

export default function Evidence() {
  const meta = useMeta();
  return (
    <>
      <h1>Evidence</h1>
      <p className="muted">How reliable are the numbers on this site, and what are the limitations?</p>

      <section aria-labelledby="how">
        <h2 id="how">Harmonization method in brief</h2>
        <ol className="steps">
          <li>Learn from the period when both satellites operated together (Feb 2012 onward)</li>
          <li>LightGBM uses 37 features: MODIS point count, fire size, land cover type (MCD12C1), season</li>
          <li>Test on regions and years the model never saw (split by region and time)</li>
          <li>Convert back to 2001 with ~80% uncertainty intervals</li>
        </ol>
      </section>

      <section aria-labelledby="score">
        <h2 id="score">Scores</h2>
        {meta.data && (
          <p>
            Overall score from data file: Poisson deviance <b className="num">{meta.data.final_test_poisson_dev.toFixed(2)}</b> (lower is better) · Data version{" "}
            <span className="num">{meta.data.data_version}</span> · Model <span className="num">{meta.data.model_id}</span> · Generated{" "}
            {meta.data.generated}
          </p>
        )}
        <div className="table-scroll">
          <table className="fc-table score-table">
            <caption className="sr-only">Regional scores on final test set</caption>
            <thead>
              <tr>
                <th>Region</th>
                <th>Poisson deviance (lower is better)</th>
                <th>Total over/under prediction</th>
              </tr>
            </thead>
            <tbody>
              {SCORES.map((s) => (
                <tr key={s.region}>
                  <td>{s.region}</td>
                  <td>
                    <span className="score-bar">
                      <i style={{ width: `${(s.dev / DEV_MAX) * 100}%` }} />
                      <b className="num">{s.dev.toFixed(2)}</b>
                    </span>
                  </td>
                  <td>
                    <span className={`bias-bar ${s.bias < 0 ? "under" : "over"}`}>
                      <i style={{ width: `${(Math.abs(s.bias) / BIAS_MAX) * 50}%` }} />
                      <b className="num">{fmtBias(s.bias)}</b>
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="score-total">
                <td>
                  <b>Overall</b>
                </td>
                <td>
                  <span className="score-bar">
                    <i style={{ width: `${(1.09 / DEV_MAX) * 100}%` }} />
                    <b className="num">1.09</b>
                  </span>
                  <span className="small muted">v2 scored 1.14 and single-factor scaling scored 5.17 (off the scale)</span>
                </td>
                <td className="muted">–</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="small muted">Source model_card.json · 622,200 test rows</p>
      </section>

      <section aria-labelledby="cont">
        <h2 id="cont">Continuity audit</h2>
        <div className="grid-2">
          {REGIONS.map((r) => (
            <div className="panel" key={r}>
              <RegionContinuity region={r} />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="lim">
        <h2 id="lim">Limitations</h2>
        {meta.isPending && <p role="status">Loading…</p>}
        {meta.isError && <LoadError error={meta.error} onRetry={() => void meta.refetch()} />}
        {meta.data && (
          <ul>
            {meta.data.known_limitations.map((t) => (
              <li key={t} lang="en">
                {t}
              </li>
            ))}
            <li>Jun–Jul 2001 Terra had a gap; values are lower than reality (no flag in data yet)</li>
          </ul>
        )}
      </section>

      <section aria-labelledby="figs" className="lt-section">
        <div className="lt-head">
          <h2 id="figs">Evidence gallery</h2>
          <p className="muted">Actual graphs from model building steps, ordered by: problem, test, weakness, result. Click to view large with explanations of what to look for.</p>
        </div>
        <EvidenceGallery />
      </section>

      <section aria-labelledby="ai">
        <h2 id="ai">AI usage</h2>
        <p>Code and documentation for this project were developed with AI assistance (per NASA Space Apps rules). All numbers come from data and models built and verified by the team.</p>
        <Link to="/data" className="btn">
          Download data →
        </Link>
      </section>
    </>
  );
}

function RegionContinuity({ region }: { region: Region }) {
  const q = useRegionCalendar(region);
  if (q.isPending) return <p role="status">Loading…</p>;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  return <ContinuityChart rows={q.data.rows} title={regionEn(region)} />;
}
