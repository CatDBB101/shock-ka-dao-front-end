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
              <span className="t1" style={{ whiteSpace: "nowrap" }}>24 Years of Fire</span>
              <span className="t2">from MODIS and VIIRS</span>
            </h1>
            <p className="orbit-lede">
              1 bar = 1 month; the taller the bar, the more fires. In 2012 the sharper VIIRS sensor replaced MODIS. Splice the two directly and fire appears to
              multiply within a single year.
            </p>

            <div className="orbit-controls">
                <p className="orbit-lede " style={{ marginBottom: "1px" }}>
              Example areas
            </p>
              <RegionTabs value={region} onChange={setRegion} />
              <div className="morph" role="group" aria-label="How the two satellite records are joined">
                <button type="button" aria-pressed={mode === "spliced"} onClick={() => setMode("spliced")}>
                  Naive splice
                </button>
                <button type="button" aria-pressed={mode === "harmonized"} onClick={() => setMode("harmonized")}>
                  Calibrated by FireCalendar+
                </button>
              </div>
              <p className="orbit-caption">
                {mode === "spliced"
                  ? "Raw MODIS before 2012, VIIRS after. Note the step at the dashed line"
                  : "Years before 2012 are converted to VIIRS-equivalent, so the step is gone. Hatched bars are computed values"}
              </p>
            </div>

            <Link to="/explore" className="btn primary">
              Choose your own area
            </Link>
          </div>

          <div className="orbit-stage">
            {q.isPending && <div className="strata-wait" role="status">Loading calendar…</div>}
            {q.isError && <LoadError error={q.error} onRetry={() => void q.refetch()} />}
            {q.data && (
              <>
                <HeatStrata rows={q.data.rows} mode={mode} label={`3D fire calendar, ${regionTh(region)}, 2001–2024`} />
                <SeamMeter rows={q.data.rows} mode={mode} />
              </>
            )}
          </div>
        </div>
      </section>

      <section className="band" aria-labelledby="flat">
        <div className="band-head">
          <h2 id="flat">Year × month table</h2>
          <p className="muted">Rows are years, columns are months; darker means more fire. Shows the region selected above.</p>
        </div>
        <div className="sheet">
          {q.isPending ? <CalendarSkeleton /> : <RegionView region={region} />}
        </div>
      </section>

      <section className="band" aria-labelledby="seam">
        <div className="band-head">
          <h2 id="seam">Annual totals before and after calibration</h2>
          <p className="muted">Grey is raw MODIS, orange is FireCalendar+. Over the VIIRS years the dashed blue line is the model's prediction, which sits almost on top of the measurements.</p>
        </div>
        <div className="sheet">{q.data ? <ContinuityChart rows={q.data.rows} title={regionTh(region)} /> : <p role="status">Loading…</p>}</div>
      </section>

      <section className="band" aria-labelledby="proof">
        <div className="band-head">
          <h2 id="proof">Accuracy on data never used for training</h2>
          <p className="muted">Poisson deviance, shorter is better, measured on areas and years held out from the start and opened once at the end.</p>
        </div>
        <div className="proof" role="img" aria-label="Single multiplier 5.17 versus FireCalendar+ 1.09">
          <div className="proof-row">
            <span>MODIS × one multiplier</span>
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
          <Link to="/evidence">See all evidence and limitations</Link>
        </p>
      </section>

      <section className="band" aria-labelledby="why">
        <h2 id="why" className="band-title-only">
          What this data gives you
        </h2>
        <dl className="facts">
          <div>
            <dt>No break in 2012</dt>
            <dd>The model learns from the years when both satellites flew, then converts MODIS back to 2001 into VIIRS units.</dd>
          </div>
          <div>
            <dt>Always says measured or computed</dt>
            <dd>Computed values are hatched and carry an ~80% likely range every month.</dd>
          </div>
          <div>
            <dt>The old satellites are retiring</dt>
            <dd>Terra and Aqua shut down in 2026–2027. The bridge between the records has to be built while there is still overlap to learn from.</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
