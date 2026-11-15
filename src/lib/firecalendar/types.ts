// Data contract — field names and enum values match the backend files and the REST API exactly.
// Do not rename fields; map names in the view layer instead (docs/02-data-contract.md)

export type Region = "africa" | "south_america" | "canada_usa" | "australia";
export type Source = "observed" | "backcast" | "backcast_terra";
/** "YYYY-MM" */
export type YearMonth = string;
export type DataMode = "static" | "api" | "mock";

export const REGIONS: readonly Region[] = ["africa", "south_america", "canada_usa", "australia"];

export interface Season {
  peak_month: number;
  start_month: number;
  end_month: number;
  method: string;
}

export interface CalendarRow {
  region: Region;
  year: number;
  month: number;
  source: Source;
  value: number;
  p_lo: number;
  p_hi: number;
  modis: number;
  viirs_model: number;
  viirs_obs: number;
  clim_median: number;
  ratio_vs_median: number;
  pct_vs_ref: number;
}

export interface CalendarFile {
  data_version: string;
  model_id: string;
  model_version: string;
  generated: string;
  unit: string;
  sources: Record<Source, string>;
  season: Record<Region, Season>;
  rows: CalendarRow[];
}

export interface IntervalRatio {
  q10: number;
  q50: number;
  q90: number;
}

export interface Manifest {
  data_version: string;
  model_id: string;
  model_version: string;
  generated: string;
  /** Don't hardcode file names — read them from here (fallback in config.ts) */
  files: Partial<Record<"calendar_region" | "cell_month" | "cell_index", string>>;
  final_test_poisson_dev: number;
  known_limitations: string[];
  calendar_interval_ratios: Record<Region, IntervalRatio>;
  /** Years the MODIS→VIIRS model was trained on, inclusive. Optional: older manifests don't record it. */
  training_years?: [number, number];
  /** Bounding box of each region as used by the backend, [minLon, minLat, maxLon, maxLat]. Optional. */
  region_bbox?: Partial<Record<Region, [number, number, number, number]>>;
}

export interface CoverageBbox {
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
}

/** `GET /v1/meta` = manifest + extra keys. In static mode `coverage_bbox`/`n_cells` may be absent. */
export interface Meta extends Manifest {
  unit: string;
  sources: Record<Source, string>;
  season: Record<Region, Season>;
  regions: Region[];
  years: [number, number];
  coverage_bbox?: CoverageBbox;
  n_cells?: number;
}

export interface RegionCalendar {
  region: Region;
  season: Season;
  rows: CalendarRow[];
}

/** One month of a user-drawn box. */
export interface AoiRow {
  year: number;
  month: number;
  source: Source;
  value: number;
  modis: number;
  viirs_model: number;
  p_lo: number;
  p_hi: number;
  clim_median: number | null;
  pct_vs_ref: number | null;
}

export interface AoiCalendar {
  cells: number;
  region: Region;
  note?: string;
  rows: AoiRow[];
  /** client-only (static mode): H3 ids of the selected cells, for drawing them on the map. Not in the API. */
  h3?: string[];
}

export interface Box {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

export type FirmsSource =
  | "MODIS_SP"
  | "MODIS_NRT"
  | "VIIRS_SNPP_SP"
  | "VIIRS_SNPP_NRT"
  | "VIIRS_NOAA20_SP"
  | "VIIRS_NOAA20_NRT"
  | "VIIRS_NOAA21_NRT";

export const FIRMS_SOURCES: readonly FirmsSource[] = [
  "VIIRS_SNPP_SP",
  "VIIRS_SNPP_NRT",
  "VIIRS_NOAA20_SP",
  "VIIRS_NOAA20_NRT",
  "VIIRS_NOAA21_NRT",
  "MODIS_SP",
  "MODIS_NRT",
];

export type ErrorKind = "validation" | "not_covered" | "not_configured" | "network" | "server";

/** A calendar cell in either shape (region rows have more fields). */
export type CalendarCell = Pick<AoiRow, "year" | "month" | "source" | "value" | "modis" | "p_lo" | "p_hi"> & {
  clim_median: number | null;
  pct_vs_ref: number | null;
  viirs_obs?: number;
};
