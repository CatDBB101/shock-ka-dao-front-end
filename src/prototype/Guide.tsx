// React port of reference/earth-pulse-guide.html (Earth Pulse prototype explainer).
import { Link } from "react-router-dom";
import { FEATURES, METRICS, STAGE, STEPS } from "./guideData";
import "./guide.css";

const RG = "linear-gradient(90deg,#3fa96b,#ffd60a,#ff9f0a,#ff3b30)";
const HG = "linear-gradient(90deg,#ffd60a,#ff9f0a,#ff3b30)";
/** colour strip per metric index: [low label, high label, gradient] */
const STRIPS: Record<number, [string, string, string]> = {
  0: ["Dry", "Lush green", "linear-gradient(90deg,#b08a3e,#3fa96b)"],
  1: ["Cool", "Hot", "linear-gradient(90deg,#3b6fd6,#ffd60a,#ff3b30)"],
  2: ["Weak", "Strong", HG],
  3: ["Low", "High", HG],
  5: ["0 Relaxed", "100 Max alert", RG],
  6: ["Never", "Frequent", HG],
  7: ["Dark", "Bright", "linear-gradient(90deg,#0b1320,#ffd60a)"],
  9: ["Cloudy", "Clear", "linear-gradient(90deg,#9aa5ad,#52c0e6)"],
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
    [145, "#b08a3e", "NDVI", "How green or dry are the trees?", "Dry = risk"],
    [295, "#e8863a", "LST", "How hot is the ground?", "Very hot = risk"],
    [445, "#ff3b30", "FRP", "Is there a fire burning right now?", "Fire found = max alert"],
  ];
  const levels: [number, number, string, string][] = [
    [40, 55, "#ff3b30", "Very high ≥75"],
    [95, 44, "#ff9f0a", "High 55–74"],
    [139, 44, "#ffd60a", "Moderate 35–54"],
    [183, 77, "#3fa96b", "Low <35"],
  ];
  return (
    <div className="info">
      <svg viewBox="0 0 800 300" role="img" aria-label="Satellites measure vegetation, heat, and fire then combine into a 0–100 risk score">
        <Arrowhead />
        <rect x="48" y="30" width="32" height="26" rx="4" fill="#8aa0b0" />
        <rect x="14" y="38" width="30" height="10" fill="#52c0e6" />
        <rect x="84" y="38" width="30" height="10" fill="#52c0e6" />
        <path className="ln" d="M64 30v-12" />
        <circle cx="64" cy="16" r="3" fill="#ff6b5e" />
        <text className="t" x="64" y="86" textAnchor="middle">Satellite</text>
        <text className="s" x="64" y="104" textAnchor="middle">Watching from space</text>
        <path className="ln" strokeDasharray="5 4" d="M80 58L210 72M80 58L360 72M80 58L510 72" />
        {boxes.map(([x, c, a, b, d]) => (
          <g key={a}>
            <rect className="bx" x={x} y="72" width="130" height="150" rx="10" />
            <rect x={x} y="72" width="130" height="5" rx="2" fill={c} />
            <text className="t" x={x + 65} y="156" textAnchor="middle">{a}</text>
            <text className="s" x={x + 65} y="176" textAnchor="middle">{b}</text>
            <text className="s" x={x + 65} y="204" textAnchor="middle" style={{ fill: c }}>{d}</text>
          </g>
        ))}
        <rect x="195" y="108" width="7" height="20" fill="#7a5a2e" />
        <circle cx="198" cy="100" r="15" fill="#3fa96b" />
        <rect x="222" y="112" width="6" height="16" fill="#7a5a2e" />
        <circle cx="225" cy="105" r="12" fill="#b08a3e" />
        <rect x="354" y="92" width="10" height="34" rx="5" fill="none" stroke="var(--mu)" strokeWidth="2" />
        <circle cx="359" cy="132" r="10" fill="#ff3b30" />
        <rect x="357" y="104" width="4" height="26" fill="#ff3b30" />
        <path d="M510 88c6 10 17 15 17 30a17 17 0 0 1-34 0c0-9 4-13 8-17 0 7 3 10 6 10 0-9-2-15 3-23z" fill="#ff3b30" />
        <path d="M510 112c3 5 8 7 8 13a8 8 0 0 1-16 0c0-4 2-6 4-8 0 3 2 5 4 5z" fill="#ffd60a" />
        <text className="s" x="145" y="238">Weight of each factor in the risk score</text>
        <rect x="145" y="244" width="150.5" height="28" fill="#b08a3e" />
        <rect x="295.5" y="244" width="193.5" height="28" fill="#e8863a" />
        <rect x="489" y="244" width="86" height="28" fill="#ff3b30" />
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
      <div className="cap">
        Read left to right: satellites measure 3 things, each with a different weight, then combine into one score. The rightmost bar's colour shows the risk level (weights are prototype demo values)
      </div>
    </div>
  );
}

function PipelineInfographic() {
  const flow: [string, string, string][] = [
    ["1", "Get ingredients", "Fetch data from satellites"],
    ["2", "Wash and sort", "Filter clouds · Merge multiple days"],
    ["3", "Cut to size", "Create tiles · Area statistics"],
    ["4", "Cook", "Time series · Sensor harmonization · Fire points · Risk"],
    ["5", "Serve", "Alerts · Visualization"],
  ];
  return (
    <div className="info">
      <div className="flow">
        {flow.map(([n, a, b]) => (
          <div className="st" key={n}>
            <b>
              {n}. {a}
            </b>
            {b}
          </div>
        ))}
      </div>
      <svg viewBox="0 0 800 230" role="img" aria-label="Data flows from satellites through servers to user browsers and phones">
        <Arrowhead />
        <rect className="bx" x="10" y="60" width="130" height="70" rx="10" />
        <text className="t" x="75" y="90" textAnchor="middle">Satellites</text>
        <text className="s" x="75" y="110" textAnchor="middle">MODIS · VIIRS</text>
        <rect className="bx" x="215" y="40" width="210" height="110" rx="10" style={{ stroke: "var(--ac)", strokeWidth: 2 }} />
        <text className="t" x="320" y="66" textAnchor="middle">Server</text>
        <text className="s" x="320" y="90" textAnchor="middle">Fetch · Filter clouds · Merge days</text>
        <text className="s" x="320" y="110" textAnchor="middle">Create tiles · Area stats</text>
        <text className="s" x="320" y="130" textAnchor="middle">Detect fires · Send alerts</text>
        <rect className="bx" x="500" y="60" width="140" height="70" rx="10" style={{ stroke: "var(--fire)", strokeWidth: 2 }} />
        <text className="t" x="570" y="90" textAnchor="middle">Browser</text>
        <text className="s" x="570" y="110" textAnchor="middle">Map · Charts · Calendar</text>
        <rect className="bx" x="690" y="60" width="100" height="70" rx="10" />
        <text className="t" x="740" y="90" textAnchor="middle">Phone</text>
        <text className="s" x="740" y="110" textAnchor="middle">User</text>
        <path className="ar" d="M140 95H212" />
        <path className="ar" d="M425 95H497" />
        <path className="ar" d="M640 95H687" />
        <rect className="bx" x="215" y="168" width="210" height="50" rx="8" style={{ stroke: "var(--ac)" }} />
        <text className="s" x="320" y="190" textAnchor="middle">Real system: runs continuously</text>
        <text className="s" x="320" y="208" textAnchor="middle">Even when no one opens the page</text>
        <rect className="bx" x="440" y="168" width="350" height="50" rx="8" style={{ stroke: "var(--fire)" }} />
        <text className="s" x="615" y="190" textAnchor="middle">Prototype: generates mock data and computes everything</text>
        <text className="s" x="615" y="208" textAnchor="middle">in this browser — no real server yet</text>
      </svg>
      <div className="cap">Blue boxes = what a real system needs. Red boxes = what this prototype does in the page</div>
    </div>
  );
}

export default function Guide() {
  return (
    <div className="ep-guide">
      <header>
        <p className="mu" style={{ margin: "0 0 8px" }}>
          <Link to="/">← FireCalendar+</Link> · <Link to="/prototype">Open Explorer Prototype</Link>
        </p>
        <h1>Earth Pulse: Prototype Guide</h1>
        <div className="mu">MODIS and VIIRS satellites for wildfire monitoring · Explained for a 10-year-old</div>
        <div className="warn">
          All numbers in this prototype are mock data (not real satellite values). The risk index formula is a demo formula and has not been validated against real fire data
        </div>
      </header>
      <nav aria-label="Topics">
        <div>
          <a href="#s1">1 Science values</a>
          <a href="#s2">2 Technical pipeline</a>
          <a href="#s3">3 What the prototype does</a>
        </div>
      </nav>
      <main>
        <section id="s1">
          <h2>1. Science values the prototype uses</h2>
          <div className="kid">
            <b>Simple explanation</b> Satellites are like cameras in space. They don't directly say "there's a fire" — they measure things like how green the trees are, how hot the ground is, and where strong hotspots are. Then we use these numbers to guess which forest areas are at risk or where a fire is burning right now.
          </div>
          <MetricsInfographic />
          <div className="grid">
            {METRICS.map(([name, kid, what, use, why, tag], i) => (
              <div className="card" key={name}>
                <h3>
                  {name}
                  <span className="tag">{tag}</span>
                </h3>
                <div className="k">In simple terms: {kid}</div>
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
                  <dt>What is it</dt>
                  <dd>{what}</dd>
                  <dt>What it's used for</dt>
                  <dd>{use}</dd>
                  <dt>Why include it</dt>
                  <dd>{why}</dd>
                </dl>
              </div>
            ))}
          </div>
        </section>
        <section id="s2">
          <h2>2. Technical pipeline behind the scenes</h2>
          <div className="kid">
            <b>Simple explanation</b> Think of it like cooking: go buy ingredients (download imagery), wash and throw out bad stuff (filter clouds), cut to size (create tiles), cook (calculate scores), then serve on time (send alerts). Each step must be done right for the final dish to be tasty and safe.
          </div>
          <div className="mu">In each step, blue boxes = what a real system must do. Red boxes = what this prototype does right now.</div>
          <PipelineInfographic />
          <div className="steps" style={{ marginTop: 12 }}>
            {STEPS.map(([name, kid, real, proto], i) => (
              <div className="step" key={name}>
                <h3>
                  {name}
                  <span className="tag">Stage: {STAGE[i]}</span>
                </h3>
                <div className="mu">In simple terms: {kid}</div>
                <div className="cols">
                  <div className="real">
                    <b>Real system must do</b>
                    {real}
                  </div>
                  <div className="proto">
                    <b>Prototype does</b>
                    {proto}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section id="s3">
          <h2>3. Summary of what the prototype does</h2>
          <div className="kid">
            <b>Simple explanation</b> This prototype is like a forest ranger's toolbox. It has a world map to look at, a calendar and charts to see history, a mode for scientists who want to know how reliable the numbers are, and a mode for firefighters who want to know where the fire is and where to go first.
          </div>
          <div className="grid">
            {FEATURES.map(([name, items]) => (
              <div className="card" key={name}>
                <h3>{name}</h3>
                <ul>
                  {items.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer>
        Sensor references from MODIS and VIIRS summary documents provided by the user (NASA LAADS / Earthdata). Risk index formula and bias adjustment values are prototype demo values.
      </footer>
    </div>
  );
}