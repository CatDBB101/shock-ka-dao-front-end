import { LEVEL_LABEL_EN, monthEn, type Season } from "../../lib/firecalendar";
import type { Series } from "./CalendarGrid";

export function Legend({ showModis = false, series: seriesProp }: { showModis?: boolean; series?: Series }) {
  const series: Series = seriesProp ?? (showModis ? "modis" : "harmonized");
  return (
    <div className="fc-legend" aria-label="Color legend">
      {LEVEL_LABEL_EN.map((l, i) => (
        <span key={l}>
          <i className={`fc-swatch fc-cell lvl-${i}`} aria-hidden="true" />
          {l}
        </span>
      ))}
      {series === "harmonized" && (
        <>
          <span>
            <i className="fc-swatch fc-cell lvl-2" aria-hidden="true" />
            VIIRS measured (observed)
          </span>
          <span>
            <i className="fc-swatch fc-cell lvl-2 src-backcast" aria-hidden="true" />
            Sparse hatch = Converted from MODIS (backcast)
          </span>
          <span>
            <i className="fc-swatch fc-cell lvl-2 src-backcast_terra" aria-hidden="true" />
            Dense hatch = Converted from Terra (less accurate)
          </span>
          <span>
            <i className="fc-swatch fc-cell lvl-2 critical" aria-hidden="true" />
            Thick border = Critical month (higher than same month in 2013–2024 in ≥ 90% of years)
          </span>
        </>
      )}
      {series === "modis" && <span>Color by raw MODIS point count (before harmonization) · Separate color scale from other series</span>}
      {series === "viirs" && (
        <>
          <span>
            <i className="fc-swatch fc-cell no-data" aria-hidden="true" />
            No VIIRS data (before Feb 2012)
          </span>
          <span>Color by points measured by VIIRS S-NPP</span>
        </>
      )}
    </div>
  );
}

export function SeasonLine({ season }: { season?: Season }) {
  if (!season) return null;
  return (
    <p className="small muted">
      Fire season: {monthEn(season.start_month)}–{monthEn(season.end_month)} · Peak {monthEn(season.peak_month)}
    </p>
  );
}