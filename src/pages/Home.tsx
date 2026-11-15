import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Region } from "../lib/firecalendar";
import { useRegionCalendar } from "../lib/firecalendar";
import { CalendarSkeleton, ContinuityChart, LoadError, RegionTabs, RegionView, regionTh } from "../components/firecalendar";
import { EarthLimb } from "../components/hero/EarthLimb";
import { HeatStrata, type StrataMode } from "../components/hero/HeatStrata";
import { SeamMeter } from "../components/hero/SeamMeter";

export default function Home() {
  const [region, setRegion] = useState<Region>("south_america");
  const [sp, setSp] = useSearchParams();
  const mode: StrataMode = sp.get("seam") === "fixed" ? "harmonized" : "spliced";
  const setMode = (m: StrataMode) => {
    const n = new URLSearchParams(sp);
    if (m === "harmonized") n.set("seam", "fixed");
    else n.delete("seam");
    setSp(n, { replace: true });
  };
  const q = useRegionCalendar(region);

  return (
    <>
      <section className="orbit" aria-labelledby="orbit-title">
        <EarthLimb region={region} />
        <div className="orbit-inner">
          <div className="orbit-copy">
            <h1 id="orbit-title" className="orbit-title">
              <span className="t1" style={{ whiteSpace: "nowrap" }}> 24 Years of Fire</span>
              <span className="t2">from MODIS and VIIRS </span>
            </h1>
            <p className="orbit-lede">
             1 bar = 1 month. Taller = more fire points. In 2012, the higher-resolution VIIRS satellite replaced MODIS. If you join the raw data directly, fire appears to jump several-fold in that single year.
            </p>

            <div className="orbit-controls">
                <p className="orbit-lede " style={{ marginBottom: "1px" }}>
             Example regions
            </p>
              <RegionTabs value={region} onChange={setRegion} />
              <div className="morph" role="group" aria-label="How to join the two satellites' data">
                <button type="button" aria-pressed={mode === "spliced"} onClick={() => setMode("spliced")}>
                  Join directly
                </button>
                <button type="button" aria-pressed={mode === "harmonized"} onClick={() => setMode("harmonized")}>
                  Harmonized with FireCalendar+
                </button>
              </div>
              <p className="orbit-caption">
                {mode === "spliced"
                  ? "Pre-2012 is raw MODIS, post-2012 is VIIRS. Notice the step at the dashed line."
                  : "Pre-2012 values are converted to VIIRS-equivalent. The step disappears. Cross-hatched bars are computed values."}
              </p>
            </div>

            <Link to="/explore" className="btn primary">
              Choose your own region
            </Link>
          </div>

          <div className="orbit-stage">
            {q.isPending && <div className="strata-wait" role="status">Loading calendar…</div>}
            {q.isError && <LoadError error={q.error} onRetry={() => void q.refetch()} />}
            {q.data && (
              <>
                <HeatStrata rows={q.data.rows} mode={mode} label={`3D fire calendar ${regionTh(region)} 2001–2024`} />
                <SeamMeter rows={q.data.rows} mode={mode} />
              </>
            )}
          </div>
        </div>
      </section>

      <section className="band" aria-labelledby="flat">
        <div className="band-head">
          <h2 id="flat">Year × Month table</h2>
          <p className="muted">Rows are years, columns are months. Darker color = more fire. Showing data for the region selected above.</p>
        </div>
        <div className="sheet">
          {q.isPending ? <CalendarSkeleton /> : <RegionView region={region} />}
        </div>
      </section>

      <section className="band" aria-labelledby="seam">
        <div className="band-head">
          <h2 id="seam">Yearly totals before and after harmonization</h2>
          <p className="muted">Grey is raw MODIS, orange is FireCalendar+. Where VIIRS exists, the blue dashed line is the model's prediction, which nearly overlaps the actual values.</p>
        </div>
        <div className="sheet">{q.data ? <ContinuityChart rows={q.data.rows} title={regionTh(region)} /> : <p role="status">Loading…</p>}</div>
      </section>

      <section className="band" aria-labelledby="proof">
        <div className="band-head">
          <h2 id="proof">Accuracy compared to held-out data</h2>
          <p className="muted">Poisson deviance — lower is better. Measured on regions and years held out from the start. Open once at the end.</p>
        </div>
        <div className="proof" role="img" aria-label="Single-factor scaling 5.17 vs FireCalendar+ 1.09">
          <div className="proof-row">
            <span>Multiply MODIS by a single factor</span>
            <i style={{ width: "100%" }} className="proof-bar base" />
            <b>5.17</b>
          </div>
          <div className="proof-row">
            <span>FireCalendar+ (LightGBM)</span>
            <i style={{ width: `${(1.09 / 5.17) * 100}%` }} className="proof-bar ours" />
            <b>1.09</b>
          </div>
        </div>
        <p className="small">
          <Link to="/evidence">View all evidence and limitations →</Link>
        </p>
      </section>

      <section className="band" aria-labelledby="why">
        <h2 id="why" className="band-title-only">
          What this data gives you
        </h2>
        <dl className="facts">
          <div>
            <dt>No 2012 break</dt>
            <dd>The model learns from years with both satellites, then converts MODIS back to 2001 in VIIRS-equivalent units.</dd>
          </div>
          <div>
            <dt>Always tells you measured vs computed</dt>
            <dd>Computed values have cross-hatching and ~80% uncertainty intervals every month.</dd>
          </div>
          <div>
            <dt>Old satellites are retiring</dt>
            <dd>Terra and Aqua stop working 2026–2027. The data bridge must be built while the overlap period still exists for training.</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
