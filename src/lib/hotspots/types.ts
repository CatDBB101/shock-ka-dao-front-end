// Hotspots API Types - matches the API documentation exactly

export type ConfidenceLevel = 'low' | 'nominal' | 'high';
export type DayNight = 'D' | 'N';
export type Satellite = 'SNPP' | 'AQUA' | 'TERRA' | 'NOAA20' | 'NOAA21';
export type Instrument = 'VIIRS' | 'MODIS';
export type OutputFormat = 'array' | 'geojson' | 'grouped-by-date' | 'grouped-by-confidence' | 'timeseries';

export interface HotspotRow {
  lat: number;
  lon: number;
  brightness: number;
  frp: number;
  confidence: ConfidenceLevel;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  satellite: Satellite;
  instrument: Instrument;
  daynight: DayNight;
}

export interface HotspotStats {
  totalCount: number;
  dateRange: { from: string; to: string } | null;
  confidenceBreakdown: Record<ConfidenceLevel, number>;
  satelliteBreakdown: Record<string, number>;
  daynightBreakdown: Record<DayNight, number>;
  frpStats: { min: number; max: number; avg: number; sum: number };
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null;
}

export interface TimeSeriesPoint {
  date: string; // YYYY-MM-DD
  count: number;
  totalFrp: number;
  avgFrp: number;
  maxFrp: number;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface HotspotsResponse<T = HotspotRow[]> {
  success: boolean;
  data: T;
  pagination?: PaginationInfo;
  stats?: HotspotStats;
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  properties: HotspotRow;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export interface GroupedByDate {
  [date: string]: HotspotRow[];
}

export interface GroupedByConfidence {
  low: HotspotRow[];
  nominal: HotspotRow[];
  high: HotspotRow[];
}

export interface Watchpoint {
  name: string;
  country: string;
  region: string;
  lat: number;
  lon: number;
}

export interface WatchpointsResponse {
  success: boolean;
  data: Watchpoint[];
}

export interface LoadResponse {
  success: boolean;
  message: string;
  count?: number;
  totalRows?: number;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  code: string;
}

export interface FilterParams {
  dateFrom?: string;
  dateTo?: string;
  confidence?: ConfidenceLevel[];
  minFrp?: number;
  maxFrp?: number;
  satellite?: Satellite[];
  daynight?: DayNight[];
  minLat?: number;
  maxLat?: number;
  minLon?: number;
  maxLon?: number;
  page?: number;
  pageSize?: number;
  format?: OutputFormat;
  includeStats?: boolean;
  simplifyCoords?: boolean;
  coordPrecision?: number;
}

export interface CSVRow {
  latitude: string;
  longitude: string;
  brightness: string;
  frp: string;
  confidence: string;
  date: string;
  time: string;
  satellite: string;
  instrument: string;
  daynight: string;
}