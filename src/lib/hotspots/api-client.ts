import type {
  HotspotRow,
  HotspotStats,
  TimeSeriesPoint,
  FilterParams,
  GeoJSONFeatureCollection,
  GroupedByDate,
  GroupedByConfidence,
  LoadResponse,
  Watchpoint,
  PaginationInfo,
} from './types';

const API_BASE = '/api';

export interface HotspotsApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: PaginationInfo;
  stats?: HotspotStats;
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
  code: string;
}

export type { FilterParams };

/**
 * Build query string from filter params
 */
function buildQueryString(params: FilterParams): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        searchParams.set(key, value.join(','));
      } else {
        searchParams.set(key, String(value));
      }
    }
  });
  return searchParams.toString();
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok || data.success === false) {
    const error = data as ApiError;
    throw new Error(`${error.error}: ${error.message} (${error.code})`);
  }

  return data as T;
}

/**
 * Hotspots API Client for frontend
 */
export const hotspotsApi = {
  /**
   * Health check
   */
  async health(): Promise<{ success: boolean; status: string; timestamp: string }> {
    return fetchApi('/health');
  },

  /**
   * Get hotspots with filtering, pagination, and format options
   */
  async getHotspots(params: FilterParams = {}): Promise<HotspotsApiResponse<
    HotspotRow[] | GeoJSONFeatureCollection | GroupedByDate | GroupedByConfidence | TimeSeriesPoint[]
  >> {
    const queryString = buildQueryString(params);
    return fetchApi(`/hotspots${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Get hotspots as array (default format)
   */
  async getHotspotsArray(params: Omit<FilterParams, 'format'> = {}): Promise<HotspotsApiResponse<HotspotRow[]>> {
    return this.getHotspots({ ...params, format: 'array' }) as Promise<HotspotsApiResponse<HotspotRow[]>>;
  },

  /**
   * Get hotspots as GeoJSON for map rendering
   */
  async getHotspotsGeoJSON(params: Omit<FilterParams, 'format'> = {}): Promise<HotspotsApiResponse<GeoJSONFeatureCollection>> {
    return this.getHotspots({ ...params, format: 'geojson' }) as Promise<HotspotsApiResponse<GeoJSONFeatureCollection>>;
  },

  /**
   * Get hotspots grouped by date
   */
  async getHotspotsGroupedByDate(params: Omit<FilterParams, 'format'> = {}): Promise<HotspotsApiResponse<GroupedByDate>> {
    return this.getHotspots({ ...params, format: 'grouped-by-date' }) as Promise<HotspotsApiResponse<GroupedByDate>>;
  },

  /**
   * Get hotspots grouped by confidence
   */
  async getHotspotsGroupedByConfidence(params: Omit<FilterParams, 'format'> = {}): Promise<HotspotsApiResponse<GroupedByConfidence>> {
    return this.getHotspots({ ...params, format: 'grouped-by-confidence' }) as Promise<HotspotsApiResponse<GroupedByConfidence>>;
  },

  /**
   * Get statistics
   */
  async getStats(params: FilterParams = {}): Promise<{ success: boolean; data: HotspotStats }> {
    const queryString = buildQueryString(params);
    return fetchApi(`/hotspots/stats${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Get time series data for charts
   */
  async getTimeSeries(params: FilterParams = {}): Promise<{ success: boolean; data: TimeSeriesPoint[] }> {
    const queryString = buildQueryString(params);
    return fetchApi(`/hotspots/timeseries${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Get GeoJSON directly (convenience endpoint)
   */
  async getGeoJSON(params: FilterParams = {}): Promise<{ success: boolean; data: GeoJSONFeatureCollection }> {
    const queryString = buildQueryString(params);
    return fetchApi(`/hotspots/geojson${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Load CSV data synchronously
   */
  async loadCsv(csv: string): Promise<LoadResponse> {
    return fetchApi('/hotspots/load', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    });
  },

  /**
   * Load CSV data asynchronously (for large datasets)
   */
  async loadCsvAsync(csv: string, batchSize = 10000): Promise<LoadResponse> {
    return fetchApi('/hotspots/load-async', {
      method: 'POST',
      body: JSON.stringify({ csv, batchSize }),
    });
  },

  /**
   * Clear all loaded data
   */
  async clear(): Promise<{ success: boolean; message: string }> {
    return fetchApi('/hotspots', { method: 'DELETE' });
  },

  /**
   * Download from FireCalendar API and load
   */
  async downloadAndLoad(params: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
    startDate: string;
    endDate: string;
    source?: string;
  }): Promise<LoadResponse> {
    return fetchApi('/hotspots/download-and-load', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  /**
   * Get watchpoints
   */
  async getWatchpoints(): Promise<{ success: boolean; data: Watchpoint[] }> {
    return fetchApi('/watchpoint');
  },
};

/**
 * React Query keys for hotspots API
 */
export const hotspotsQueryKeys = {
  all: ['hotspots'] as const,
  list: (params: FilterParams) => ['hotspots', 'list', params] as const,
  stats: (params: FilterParams) => ['hotspots', 'stats', params] as const,
  timeSeries: (params: FilterParams) => ['hotspots', 'timeseries', params] as const,
  geoJSON: (params: FilterParams) => ['hotspots', 'geojson', params] as const,
  watchpoints: ['hotspots', 'watchpoints'] as const,
};