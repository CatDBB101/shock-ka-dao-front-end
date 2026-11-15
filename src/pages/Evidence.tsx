import { Link } from "react-router-dom";
import { REGIONS, useMeta, useRegionCalendar, type Region } from "../lib/firecalendar";
import { ContinuityChart, LoadError, regionTh } from "../components/firecalendar";
import { EvidenceGallery } from "./evidence/EvidenceGallery";
import { monthTh, sourceFor, VIIRS_GAP_MONTHS } from "../lib/firecalendar/time";
import { SNPP_LAST_DATE } from "../lib/firecalendar/firms";

// Source: model_card.json · final test set 622,200 rows (switch to /v1/meta/eval when it exists)
const SCORES: { region: string; dev: number; bias: number }[] = [
  { region: "Africa", dev: 1.98, bias: -6.8 },
  { region: "South America", dev: 1.33, bias: -2.3 },
  { region: "Canada + United States", dev: 0.81, bias: -10.6 },
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
      <p className="muted">How far the numbers on this site can be trusted, and where they fall short.</p>

      <section aria-labelledby="how">
        <h2 id="how">How the conversion works</h2>
        <ol className="steps">
          <li>Learn from the period when both satellites flew together (Feb 2012 onward)</li>
          <li>LightGBM uses 37 features, such as MODIS detection counts, fire size, land cover (MCD12C1) and season</li>
          <li>Test on areas and years the model never saw (split by space and time)</li>
          <li>Convert back to 2001 with ~80% uncertainty ranges</li>
        </ol>
      </section>

      <section aria-labelledby="score">
        <h2 id="score">Scores</h2>
        {meta.data && (
          <p>
            Overall score from the data file: Poisson deviance <b className="num">{meta.data.final_test_poisson_dev.toFixed(2)}</b> (lower is better) · data{" "}
            <span className="num">{meta.data.data_version}</span> · model <span className="num">{meta.data.model_id}</span> · built{" "}
            {meta.data.generated}
          </p>
        )}
        <div className="table-scroll">
          <table className="fc-table score-table">
            <caption className="sr-only">Per-region scores on the final held-out test</caption>
            <thead>
              <tr>
                <th>Region</th>
                <th>Poisson deviance (shorter is better)</th>
                <th>Overall over / under</th>
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
                  <b>All</b>
                </td>
                <td>
                  <span className="score-bar">
                    <i style={{ width: `${(1.09 / DEV_MAX) * 100}%` }} />
                    <b className="num">1.09</b>
                  </span>
                  <span className="small muted">v2 scored 1.14; the single multiplier scored 5.17 (off the scale)</span>
                </td>
                <td className="muted">–</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="small muted">Source: model_card.json · test set 622,200 rows</p>
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
            <li>Terra had an outage in Jun–Jul 2001, so those months read low (not yet flagged in the data)</li>
          </ul>
        )}
      </section>

      <section aria-labelledby="audit">
        <h2 id="audit">Check against the research</h2>
        <p className="muted">Where the site's data differs from the research findings, and what the site does so the numbers aren't misread.</p>
        <ul className="stack">
          <li>
            <b>Months with incomplete VIIRS data:</b>{" "}
            {Object.keys(VIIRS_GAP_MONTHS)
              .filter((ym) => {
                const p = ym.split("-");
                return sourceFor(Number(p[0]), Number(p[1])) === "observed"; // Jan 2012 is already a backcast month
              })
              .map((ym) => {
                const p = ym.split("-");
                return `${monthTh(Number(p[1]))} ${p[0]}`;
              })
              .join(", ")}{" "}
            The data still labels them observed, but the calendar outlines them with a dashed ring. Low values in these months may be missing data.
          </li>
          <li>
            <b>Africa region box:</b> the site uses Angola{" "}
            {meta.data?.region_bbox?.africa ? `(${meta.data.region_bbox.africa.join(", ")})` : "(longitude about 11.7–24°E)"}, while the research used 12–7°S, 22–27°E
            (DR Congo / Zambia), so the research's African k and R² do not apply to the numbers here.
          </li>
          <li>
            <b>Training years:</b>{" "}
            {meta.data?.training_years
              ? `${meta.data.training_years[0]}–${meta.data.training_years[1]} (from the manifest)`
              : "not recorded in the manifest. The research used 2012–2021 because Aqua's orbit drifted after 2021, so read 2022–2024 values with care"}
          </li>
          <li>
            <b>Reference satellite:</b> the calendar is referenced to VIIRS S-NPP, which delivered data to FIRMS until {SNPP_LAST_DATE}. Since then the watchpoint page uses NOAA-20 and NOAA-21.
            Extending the calendar past 2024 requires calibrating NOAA-20 against S-NPP first.
          </li>
          <li>
            <b>Non-vegetation fires:</b> raw hotspot downloads and the watchpoint page drop volcanoes and static heat sources (type ≠ 0) whenever the file has a type column
            (SP data only).
          </li>
        </ul>
      </section>

      <section aria-labelledby="figs" className="lt-section">
        <div className="lt-head">
          <h2 id="figs">Evidence figures</h2>
          <p className="muted">Figures from the model-building pipeline, ordered as problem, tests, weaknesses and result. Open one for a larger view and notes on what to look at.</p>
        </div>
        <EvidenceGallery />
      </section>

      <section aria-labelledby="ai">
        <h2 id="ai">Use of AI</h2>
        <p>The code and documentation were developed with AI assistance (per NASA Space Apps rules). Every number comes from data and models the team built and checked.</p>
        <Link to="/data" className="btn">
          Download the data →
        </Link>
      </section>
    </>
  );
}

function RegionContinuity({ region }: { region: Region }) {
  const q = useRegionCalendar(region);
  if (q.isPending) return <p role="status">Loading…</p>;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  return <ContinuityChart rows={q.data.rows} title={regionTh(region)} />;
}
