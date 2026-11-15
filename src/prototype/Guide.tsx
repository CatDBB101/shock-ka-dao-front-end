// React port of reference/earth-pulse-guide.html (Earth Pulse prototype explainer).
import { Link } from "react-router-dom";
import { FEATURES, METRICS, STAGE, STEPS } from "./guideData";
import "./guide.css";

const RG = "linear-gradient(90deg,#3fa96b,#e9c43b,#e8863a,#c8392d)";
const HG = "linear-gradient(90deg,#e9c43b,#e8863a,#c8392d)";
/** colour strip per metric index: [low label, high label, gradient] */
const STRIPS: Record<number, [string, string, string]> = {
  0: ["Dry", "Lush", "linear-gradient(90deg,#b08a3e,#3fa96b)"],
  1: ["Cool", "Hot", "linear-gradient(90deg,#3b6fd6,#e9c43b,#c8392d)"],
  2: ["Weak", "Intense", HG],
  3: ["Low", "High", HG],
  5: ["0 calm", "100 extreme", RG],
  6: ["Never", "Often", HG],
  7: ["Dark", "Bright", "linear-gradient(90deg,#0b1320,#e9c43b)"],
  9: ["Cloudy", "Clear", "linear-gradient(90deg,#9aa5ad,#2f8fb5)"],
};

const Arrowhead = () => (
  <defs>
    <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M0 0L10 5L0 10z" className="mk" />
    </marker>
  </defs>
);

function MetricsInfographic() {
  const boxes: [number, string, string, string, string][] = [
    [145, "#b08a3e", "NDVI", "Green or dry?", "Dry = risk"],
    [295, "#e8863a", "LST", "How hot is the ground?", "Very hot = risk"],
    [445, "#c8392d", "FRP", "Is something burning?", "Fire = top alert"],
  ];
  const levels: [number, number, string, string][] = [
    [40, 55, "#c8392d", "Very high ≥75"],
    [95, 44, "#e8863a", "High 55–74"],
    [139, 44, "#e9c43b", "Moderate 35–54"],
    [183, 77, "#3fa96b", "Low <35"],
  ];
  return (
    <figure className="info">
      <svg viewBox="0 0 800 300" role="img" aria-label="The satellite measures vegetation, heat and fire, which combine into a 0 to 100 risk score">
        <Arrowhead />
        <rect x="48" y="30" width="32" height="26" rx="4" fill="#8aa0b0" />
        <rect x="14" y="38" width="30" height="10" fill="#2f8fb5" />
        <rect x="84" y="38" width="30" height="10" fill="#2f8fb5" />
        <path className="ln" d="M64 30v-12" />
        <circle cx="64" cy="16" r="3" fill="#c8392d" />
        <text className="t" x="64" y="86" textAnchor="middle">Satellite</text>
        <text className="s" x="64" y="104" textAnchor="middle">view from orbit</text>
        <path className="ln" strokeDasharray="5 4" d="M80 58L210 72M80 58L360 72M80 58L510 72" />
        {boxes.map(([x, c, a, b, d]) => (
          <g key={a}>
            <rect className="bx" x={x} y="72" width="130" height="150" rx="6" />
            <rect x={x} y="72" width="130" height="4" fill={c} />
            <text className="t" x={x + 65} y="156" textAnchor="middle">{a}</text>
            <text className="s" x={x + 65} y="176" textAnchor="middle">{b}</text>
            <text className="s strong" x={x + 65} y="204" textAnchor="middle">{d}</text>
          </g>
        ))}
        <rect x="195" y="108" width="7" height="20" fill="#7a5a2e" />
        <circle cx="198" cy="100" r="15" fill="#3fa96b" />
        <rect x="222" y="112" width="6" height="16" fill="#7a5a2e" />
        <circle cx="225" cy="105" r="12" fill="#b08a3e" />
        <rect x="354" y="92" width="10" height="34" rx="5" fill="none" stroke="var(--mu)" strokeWidth="2" />
        <circle cx="359" cy="132" r="10" fill="#c8392d" />
        <rect x="357" y="104" width="4" height="26" fill="#c8392d" />
        <path d="M510 88c6 10 17 15 17 30a17 17 0 0 1-34 0c0-9 4-13 8-17 0 7 3 10 6 10 0-9-2-15 3-23z" fill="#c8392d" />
        <path d="M510 112c3 5 8 7 8 13a8 8 0 0 1-16 0c0-4 2-6 4-8 0 3 2 5 4 5z" fill="#e9c43b" />
        <text className="s" x="145" y="238">Weight of each factor in the risk score</text>
        <rect x="145" y="244" width="150.5" height="28" fill="#7a5a2e" />
        <rect x="295.5" y="244" width="193.5" height="28" fill="#a8521f" />
        <rect x="489" y="244" width="86" height="28" fill="#9b2a20" />
        <text className="w" x="220" y="263" textAnchor="middle">Dryness 35%</text>
        <text className="w" x="392" y="263" textAnchor="middle">Heat 45%</text>
        <text className="w" x="532" y="263" textAnchor="middle">Fire 20%</text>
        <path className="ar" d="M578 258C612 258 622 228 644 214" />
        <text className="t" x="670" y="28" textAnchor="middle">Risk score 0–100</text>
        {levels.map(([y, h, c, l]) => (
          <g key={l}>
            <rect x="650" y={y} width="40" height={h} fill={c} />
            <text className="s" x="698" y={y + h / 2 + 4}>{l}</text>
          </g>
        ))}
      </svg>
      <figcaption className="cap">
        Read left to right: the satellite measures three things, each with a different weight, combined into a single score. The colour bar on the right shows the
        risk level. Weights are prototype demo values.
      </figcaption>
    </figure>
  );
}

function PipelineInfographic() {
  const flow: [string, string, string][] = [
    ["1", "Acquire", "Download satellite data"],
    ["2", "Clean", "Mask clouds · composite days"],
    ["3", "Grid", "Tiles · zonal statistics"],
    ["4", "Analyse", "Time series · harmonization · hotspots · risk"],
    ["5", "Deliver", "Alerts · visualisation"],
  ];
  return (
    <figure className="info">
      <ol className="flow">
        {flow.map(([n, a, b]) => (
          <li className="st" key={n}>
            <span className="st-n">{n}</span>
            <b>{a}</b>
            <span>{b}</span>
          </li>
        ))}
      </ol>
      <svg viewBox="0 0 800 230" role="img" aria-label="Data flows from the satellite through the server to the user's browser and phone">
        <Arrowhead />
        <rect className="bx" x="10" y="60" width="130" height="70" rx="6" />
        <text className="t" x="75" y="90" textAnchor="middle">Satellite</text>
        <text className="s" x="75" y="110" textAnchor="middle">MODIS · VIIRS</text>
        <rect className="bx" x="215" y="40" width="210" height="110" rx="6" style={{ stroke: "var(--ac)", strokeWidth: 2 }} />
        <text className="t" x="320" y="66" textAnchor="middle">Server</text>
        <text className="s" x="320" y="90" textAnchor="middle">fetch · mask clouds · composite</text>
        <text className="s" x="320" y="110" textAnchor="middle">tiles · zonal statistics</text>
        <text className="s" x="320" y="130" textAnchor="middle">detect fires · send alerts</text>
        <rect className="bx" x="500" y="60" width="140" height="70" rx="6" style={{ stroke: "var(--fire)", strokeWidth: 2 }} />
        <text className="t" x="570" y="90" textAnchor="middle">Browser</text>
        <text className="s" x="570" y="110" textAnchor="middle">map, charts, calendar</text>
        <rect className="bx" x="690" y="60" width="100" height="70" rx="6" />
        <text className="t" x="740" y="90" textAnchor="middle">Phone</text>
        <text className="s" x="740" y="110" textAnchor="middle">end user</text>
        <path className="ar" d="M140 95H212" />
        <path className="ar" d="M425 95H497" />
        <path className="ar" d="M640 95H687" />
        <rect className="bx" x="215" y="168" width="210" height="50" rx="6" style={{ stroke: "var(--ac)" }} />
        <text className="s" x="320" y="190" textAnchor="middle">Production: runs continuously,</text>
        <text className="s" x="320" y="208" textAnchor="middle">even when no one has the page open</text>
        <rect className="bx" x="440" y="168" width="350" height="50" rx="6" style={{ stroke: "var(--fire)" }} />
        <text className="s" x="615" y="190" textAnchor="middle">Prototype: generates simulated data and computes everything</text>
        <text className="s" x="615" y="208" textAnchor="middle">in this browser; there is no real server yet</text>
      </svg>
      <figcaption className="cap">Blue outlines are what a production system needs; red outlines are what the prototype does inside the page instead.</figcaption>
    </figure>
  );
}

export default function Guide() {
  return (
    <div className="ep-guide">
      <header>
        <p className="crumbs">
          <Link to="/">FireCalendar+</Link>
          <span aria-hidden="true">/</span>
          <Link to="/prototype">Open the Explorer prototype</Link>
        </p>
        <p className="eyebrow">Prototype documentation</p>
        <h1>Earth Pulse</h1>
        <p className="lede">How the MODIS and VIIRS wildfire-monitoring prototype works: the measurements it uses, the processing behind it, and what it can and cannot do.</p>
        <p className="warn">
          <b>Simulated data.</b> Every number in this prototype is mock data, not satellite measurements. The risk formula is a demonstration and has not been validated
          against real fires.
        </p>
      </header>
      <nav aria-label="Sections">
        <div>
          <a href="#s1">
            <span>01</span> Measurements
          </a>
          <a href="#s2">
            <span>02</span> Processing
          </a>
          <a href="#s3">
            <span>03</span> Capabilities
          </a>
        </div>
      </nav>
      <main>
        <section id="s1">
          <h2>Measurements the prototype uses</h2>
          <p className="brief">
            A satellite is a camera in orbit. It never reports "fire" directly; it measures how green the vegetation is, how hot the ground is, and where there are
            intense hot spots. Those numbers are combined to estimate where forest is at risk and where fire is burning now.
          </p>
          <MetricsInfographic />
          <div className="grid">
            {METRICS.map(([name, kid, what, use, why, tag], i) => (
              <article className="card" key={name}>
                <header className="card-h">
                  <h3>{name}</h3>
                  <span className="tag">{tag}</span>
                </header>
                <p className="k">{kid}</p>
                {STRIPS[i] && (
                  <div>
                    <div className="strip" style={{ background: STRIPS[i][2] }} />
                    <div className="sl">
                      <span>{STRIPS[i][0]}</span>
                      <span>{STRIPS[i][1]}</span>
                    </div>
                  </div>
                )}
                <dl>
                  <dt>Definition</dt>
                  <dd>{what}</dd>
                  <dt>Used for</dt>
                  <dd>{use}</dd>
                  <dt>Why it matters</dt>
                  <dd>{why}</dd>
                </dl>
              </article>
            ))}
          </div>
        </section>
        <section id="s2">
          <h2>Processing behind the scenes</h2>
          <p className="brief">
            Each stage feeds the next: acquire the granules, remove cloud and bad pixels, cut the data into a grid, compute the indicators, then deliver alerts in time.
            An error early in the chain carries through to the final map.
          </p>
          <PipelineInfographic />
          <ol className="steps">
            {STEPS.map(([name, kid, real, proto], i) => (
              <li className="step" key={name}>
                <header className="card-h">
                  <h3>{name}</h3>
                  <span className="tag">{STAGE[i]}</span>
                </header>
                <p className="mu">{kid}</p>
                <div className="cols">
                  <div className="real">
                    <b>Production system</b>
                    {real}
                  </div>
                  <div className="proto">
                    <b>This prototype</b>
                    {proto}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section id="s3">
          <h2>What the prototype can do</h2>
          <p className="brief">
            A toolkit for people who watch forests: a world map, a calendar and history charts, a scientist view for judging how reliable the numbers are, and a
            firefighter view for seeing where fire is and where to go first.
          </p>
          <div className="grid">
            {FEATURES.map(([name, items]) => (
              <article className="card" key={name}>
                <h3>{name}</h3>
                <ul>
                  {items.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer>
        Sensor details follow the MODIS and VIIRS summaries from NASA LAADS / Earthdata. The risk formula and bias adjustments are prototype demonstration values.
      </footer>
    </div>
  );
}
