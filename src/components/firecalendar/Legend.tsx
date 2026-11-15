import { LEVEL_LABEL_TH, monthTh, type Season } from "../../lib/firecalendar";
import type { Series } from "./CalendarGrid";

export function Legend({ showModis = false, series: seriesProp }: { showModis?: boolean; series?: Series }) {
  const series: Series = seriesProp ?? (showModis ? "modis" : "harmonized");
  return (
    <div className="fc-legend" aria-label="Colour legend">
      {LEVEL_LABEL_TH.map((l, i) => (
        <span key={l}>
          <i className={`fc-swatch fc-cell lvl-${i}`} aria-hidden="true" />
          {l}
        </span>
      ))}
      {series === "harmonized" && (
        <>
          <span>
            <i className="fc-swatch fc-cell lvl-2" aria-hidden="true" />
            Measured by VIIRS (observed)
          </span>
          <span>
            <i className="fc-swatch fc-cell lvl-2 src-backcast" aria-hidden="true" />
            Wide hatch = converted from MODIS (backcast)
          </span>
          <span>
            <i className="fc-swatch fc-cell lvl-2 src-backcast_terra" aria-hidden="true" />
            Dense hatch = converted from Terra (less accurate)
          </span>
          <span>
            <i className="fc-swatch fc-cell lvl-2 critical" aria-hidden="true" />
            Thick outline = critical month (above the same month in ≥ 90% of 2013–2024)
          </span>
          <GapSwatch />
        </>
      )}
      {series === "modis" && <span>Colour by raw MODIS detections (before calibration) · colour scale computed separately</span>}
      {series === "viirs" && (
        <>
          <span>
            <i className="fc-swatch fc-cell no-data" aria-hidden="true" />
            No VIIRS data (before Feb 2012)
          </span>
          <GapSwatch />
          <span>Colour by detections measured by VIIRS S-NPP (S-NPP delivered data until 2 Nov 2026; NOAA-20/21 after that)</span>
        </>
      )}
    </div>
  );
}

function GapSwatch() {
  return (
    <span>
      <i className="fc-swatch fc-cell lvl-2 viirs-gap" aria-hidden="true" />
      Dashed outline = incomplete VIIRS month, value may be too low
    </span>
  );
}

export function SeasonLine({ season }: { season?: Season }) {
  if (!season) return null;
  return (
    <p className="small muted">
      Fire season: {monthTh(season.start_month)}–{monthTh(season.end_month)} · peak {monthTh(season.peak_month)}
    </p>
  );
}
