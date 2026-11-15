import type {
  HotspotRow,
  HotspotStats,
  TimeSeriesPoint,
  FilterParams,
  OutputFormat,
  ConfidenceLevel,
  DayNight,
  Satellite,
  GeoJSONFeatureCollection,
  GroupedByDate,
  GroupedByConfidence,
  PaginationInfo,
} from './types';

/**
 * HotspotsController - Pure TypeScript business logic for hotspots data
 * ZERO network calls - only data transformation, filtering, formatting
 * Can be used in CLI, workers, tests, or any server
 */
export class HotspotsController {
  private data: HotspotRow[] = [];
  private statsCache: HotspotStats | null = null;
  private statsCacheValid = false;

  /**
   * Load CSV data synchronously
   */
  loadCsv(csvText: string): { count: number } {
    const rows = this.parseCsv(csvText);
    this.data = rows;
    this.invalidateStatsCache();
    return { count: rows.length };
  }

  /**
   * Load CSV data asynchronously in batches (yields to event loop)
   */
  async loadCsvAsync(csvText: string, batchSize = 10000): Promise<{ totalRows: number }> {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      this.data = [];
      this.invalidateStatsCache();
      return { totalRows: 0 };
    }

    const firstLine = lines[0];
    if (!firstLine) {
      this.data = [];
      this.invalidateStatsCache();
      return { totalRows: 0 };
    }
    const headers = this.parseCsvLine(firstLine);
    const rows: HotspotRow[] = [];

    for (let i = 1; i < lines.length; i += batchSize) {
      const batch = lines.slice(i, Math.min(i + batchSize, lines.length));
      for (const line of batch) {
        if (!line) continue;
        const row = this.parseCsvRow(line, headers);
        if (row) rows.push(row);
      }
      // Yield to event loop between batches
      if (i + batchSize < lines.length) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    this.data = rows;
    this.invalidateStatsCache();
    return { totalRows: rows.length };
  }

  /**
   * Clear all loaded data
   */
  clear(): void {
    this.data = [];
    this.invalidateStatsCache();
  }

  /**
   * Get current data count
   */
  getCount(): number {
    return this.data.length;
  }

  /**
   * Check if data is loaded
   */
  hasData(): boolean {
    return this.data.length > 0;
  }

  /**
   * Query hotspots with filtering, pagination, and formatting
   */
  query(params: FilterParams = {}): {
    data: HotspotRow[] | GeoJSONFeatureCollection | GroupedByDate | GroupedByConfidence | TimeSeriesPoint[];
    pagination?: PaginationInfo;
    stats?: HotspotStats;
  } {
    if (!this.hasData()) {
      throw new Error('DATA_NOT_LOADED');
    }

    // Apply filters
    let filtered = this.applyFilters(this.data, params);

    // Compute stats if requested (before pagination)
    let stats: HotspotStats | undefined;
    if (params.includeStats) {
      stats = this.computeStats(filtered);
    }

    // Apply pagination (except for special formats that don't paginate)
    let pagination: PaginationInfo | undefined;
    const format = params.format || 'array';
    const shouldPaginate = format === 'array' || format === 'geojson';

    if (shouldPaginate) {
      const page = params.page || 1;
      const pageSize = Math.min(params.pageSize || 1000, 10000);
      const totalItems = filtered.length;
      const totalPages = Math.ceil(totalItems / pageSize);
      const start = (page - 1) * pageSize;
      const end = start + pageSize;

      pagination = {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };

      filtered = filtered.slice(start, end);
    }

    // Format output
    let formattedData: any = filtered;
    switch (format) {
      case 'geojson':
        formattedData = this.toGeoJSON(filtered);
        break;
      case 'grouped-by-date':
        formattedData = this.groupByDate(filtered);
        break;
      case 'grouped-by-confidence':
        formattedData = this.groupByConfidence(filtered);
        break;
      case 'timeseries':
        formattedData = this.toTimeSeries(filtered);
        break;
      case 'array':
      default:
        formattedData = filtered;
        break;
    }

    // Simplify coordinates if requested
    if (params.simplifyCoords && format !== 'timeseries') {
      formattedData = this.simplifyCoordinates(formattedData, params.coordPrecision || 4, format);
    }

    return { data: formattedData, pagination, stats };
  }

  /**
   * Get statistics for current data (with optional filters)
   */
  getStats(params: FilterParams = {}): HotspotStats {
    if (!this.hasData()) {
      throw new Error('DATA_NOT_LOADED');
    }

    const filtered = this.applyFilters(this.data, params);
    return this.computeStats(filtered);
  }

  /**
   * Get time series data (convenience method)
   */
  getTimeSeries(params: FilterParams = {}): TimeSeriesPoint[] {
    if (!this.hasData()) {
      throw new Error('DATA_NOT_LOADED');
    }

    const filtered = this.applyFilters(this.data, params);
    return this.toTimeSeries(filtered);
  }

  /**
   * Get GeoJSON data (convenience method)
   */
  getGeoJSON(params: FilterParams = {}): GeoJSONFeatureCollection {
    if (!this.hasData()) {
      throw new Error('DATA_NOT_LOADED');
    }

    const filtered = this.applyFilters(this.data, params);
    return this.toGeoJSON(filtered);
  }

  // ==================== Private Methods ====================

  private parseCsv(csvText: string): HotspotRow[] {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const firstLine = lines[0];
    if (!firstLine) return [];
    const headers = this.parseCsvLine(firstLine);
    const rows: HotspotRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const row = this.parseCsvRow(line, headers);
      if (row) rows.push(row);
    }

    return rows;
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  private parseCsvRow(line: string, headers: string[]): HotspotRow | null {
    const values = this.parseCsvLine(line);
    if (values.length !== headers.length) return null;

    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h.toLowerCase()] = values[i]?.trim() || ''));

    // Validate required fields - provide defaults for missing
    const lat = parseFloat(row.latitude || '');
    const lon = parseFloat(row.longitude || '');
    const brightness = parseFloat(row.brightness || '');
    const frp = parseFloat(row.frp || '');

    if (isNaN(lat) || isNaN(lon) || isNaN(brightness) || isNaN(frp)) return null;

    // Normalize confidence
    const confidence = this.normalizeConfidence(row.confidence || 'low');
    const daynight = this.normalizeDayNight(row.daynight || 'D');
    const satellite = this.normalizeSatellite(row.satellite || 'SNPP');
    const instrument = this.normalizeInstrument(row.instrument || 'VIIRS');

    return {
      lat,
      lon,
      brightness,
      frp,
      confidence,
      date: row.date || '',
      time: (row.time || '').padStart(4, '0') || '00:00',
      satellite,
      instrument,
      daynight,
    };
  }

  private normalizeConfidence(value: string): ConfidenceLevel {
    const v = value.toLowerCase();
    if (v === 'high' || v === 'h' || v === '3') return 'high';
    if (v === 'nominal' || v === 'n' || v === '2') return 'nominal';
    return 'low'; // default for 'low', 'l', '1', or unknown
  }

  private normalizeDayNight(value: string): DayNight {
    const v = value.toUpperCase().charAt(0);
    return v === 'N' ? 'N' : 'D';
  }

  private normalizeSatellite(value: string): Satellite {
    const v = value.toUpperCase();
    if (v.includes('SNPP') || v === 'SNPP') return 'SNPP';
    if (v.includes('AQUA') || v === 'AQUA') return 'AQUA';
    if (v.includes('TERRA') || v === 'TERRA') return 'TERRA';
    if (v.includes('NOAA20') || v === 'NOAA20') return 'NOAA20';
    if (v.includes('NOAA21') || v === 'NOAA21') return 'NOAA21';
    return 'SNPP'; // default
  }

  private normalizeInstrument(value: string): 'VIIRS' | 'MODIS' {
    const v = value.toUpperCase();
    return v.includes('MODIS') ? 'MODIS' : 'VIIRS';
  }

  private applyFilters(data: HotspotRow[], params: FilterParams): HotspotRow[] {
    return data.filter((row) => {
      // Date range filter
      if (params.dateFrom && row.date < params.dateFrom) return false;
      if (params.dateTo && row.date > params.dateTo) return false;

      // Confidence filter
      if (params.confidence && params.confidence.length > 0) {
        if (!params.confidence.includes(row.confidence)) return false;
      }

      // FRP filter
      if (params.minFrp !== undefined && row.frp < params.minFrp) return false;
      if (params.maxFrp !== undefined && row.frp > params.maxFrp) return false;

      // Satellite filter
      if (params.satellite && params.satellite.length > 0) {
        if (!params.satellite.includes(row.satellite)) return false;
      }

      // Day/night filter
      if (params.daynight && params.daynight.length > 0) {
        if (!params.daynight.includes(row.daynight)) return false;
      }

      // Bounding box filter
      if (params.minLat !== undefined && row.lat < params.minLat) return false;
      if (params.maxLat !== undefined && row.lat > params.maxLat) return false;
      if (params.minLon !== undefined && row.lon < params.minLon) return false;
      if (params.maxLon !== undefined && row.lon > params.maxLon) return false;

      return true;
    });
  }

  private computeStats(data: HotspotRow[]): HotspotStats {
    // Check cache
    if (this.statsCacheValid && this.statsCache) {
      // For filtered data, we can't use cache - compute fresh
      // Cache is only valid for unfiltered full dataset
    }

    if (data.length === 0) {
      return this.emptyStats();
    }

    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;
    let minFrp = Infinity, maxFrp = -Infinity, sumFrp = 0;

    const confidenceBreakdown: Record<ConfidenceLevel, number> = { low: 0, nominal: 0, high: 0 };
    const satelliteBreakdown: Record<string, number> = {};
    const daynightBreakdown: Record<DayNight, number> = { D: 0, N: 0 };

    let minDate: string | null = null;
    let maxDate: string | null = null;

    for (const row of data) {
      // Bounding box
      minLat = Math.min(minLat, row.lat);
      maxLat = Math.max(maxLat, row.lat);
      minLon = Math.min(minLon, row.lon);
      maxLon = Math.max(maxLon, row.lon);

      // FRP stats
      minFrp = Math.min(minFrp, row.frp);
      maxFrp = Math.max(maxFrp, row.frp);
      sumFrp += row.frp;

      // Breakdowns
      confidenceBreakdown[row.confidence]++;
      satelliteBreakdown[row.satellite] = (satelliteBreakdown[row.satellite] || 0) + 1;
      daynightBreakdown[row.daynight]++;

      // Date range
      if (!minDate || row.date < minDate) minDate = row.date;
      if (!maxDate || row.date > maxDate) maxDate = row.date;
    }

    const stats: HotspotStats = {
      totalCount: data.length,
      dateRange: minDate && maxDate ? { from: minDate, to: maxDate } : null,
      confidenceBreakdown,
      satelliteBreakdown,
      daynightBreakdown,
      frpStats: {
        min: minFrp === Infinity ? 0 : minFrp,
        max: maxFrp === -Infinity ? 0 : maxFrp,
        avg: sumFrp / data.length,
        sum: sumFrp,
      },
      bbox:
        minLat === Infinity
          ? null
          : { minLat, maxLat, minLon, maxLon },
    };

    // Cache if this is the full dataset (no filters applied)
    const hasFilters = Object.keys(arguments[1] || {}).length > 0;
    if (!hasFilters) {
      this.statsCache = stats;
      this.statsCacheValid = true;
    }

    return stats;
  }

  private emptyStats(): HotspotStats {
    return {
      totalCount: 0,
      dateRange: null,
      confidenceBreakdown: { low: 0, nominal: 0, high: 0 },
      satelliteBreakdown: {},
      daynightBreakdown: { D: 0, N: 0 },
      frpStats: { min: 0, max: 0, avg: 0, sum: 0 },
      bbox: null,
    };
  }

  private toGeoJSON(data: HotspotRow[]): GeoJSONFeatureCollection {
    return {
      type: 'FeatureCollection',
      features: data.map((row) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [row.lon, row.lat],
        },
        properties: row,
      })),
    };
  }

  private groupByDate(data: HotspotRow[]): GroupedByDate {
    const grouped: GroupedByDate = {};
    for (const row of data) {
      const date = row.date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date]!.push(row);
    }
    return grouped;
  }

  private groupByConfidence(data: HotspotRow[]): GroupedByConfidence {
    const grouped: GroupedByConfidence = { low: [], nominal: [], high: [] };
    for (const row of data) {
      grouped[row.confidence].push(row);
    }
    return grouped;
  }

  private toTimeSeries(data: HotspotRow[]): TimeSeriesPoint[] {
    const dailyMap = new Map<string, { count: number; totalFrp: number; maxFrp: number }>();

    for (const row of data) {
      const existing = dailyMap.get(row.date) || { count: 0, totalFrp: 0, maxFrp: 0 };
      existing.count++;
      existing.totalFrp += row.frp;
      existing.maxFrp = Math.max(existing.maxFrp, row.frp);
      dailyMap.set(row.date, existing);
    }

    // Sort by date
    const sortedDates = Array.from(dailyMap.keys()).sort();

    return sortedDates.map((date) => {
      const d = dailyMap.get(date)!;
      return {
        date,
        count: d.count,
        totalFrp: d.totalFrp,
        avgFrp: d.totalFrp / d.count,
        maxFrp: d.maxFrp,
      };
    });
  }

  private simplifyCoordinates(
    data: any,
    precision: number,
    format: OutputFormat
  ): any {
    const factor = Math.pow(10, Math.min(Math.max(precision, 1), 6));
    const round = (n: number) => Math.round(n * factor) / factor;

    switch (format) {
      case 'geojson':
        return {
          ...data,
          features: data.features.map((f: any) => ({
            ...f,
            geometry: {
              ...f.geometry,
              coordinates: [round(f.geometry.coordinates[0]), round(f.geometry.coordinates[1])],
            },
            properties: {
              ...f.properties,
              lat: round(f.properties.lat),
              lon: round(f.properties.lon),
            },
          })),
        };
      case 'grouped-by-date':
        const grouped: any = {};
        for (const [date, rows] of Object.entries(data)) {
          grouped[date] = (rows as HotspotRow[]).map((r) => ({
            ...r,
            lat: round(r.lat),
            lon: round(r.lon),
          }));
        }
        return grouped;
      case 'grouped-by-confidence':
        return {
          low: data.low.map((r: HotspotRow) => ({ ...r, lat: round(r.lat), lon: round(r.lon) })),
          nominal: data.nominal.map((r: HotspotRow) => ({ ...r, lat: round(r.lat), lon: round(r.lon) })),
          high: data.high.map((r: HotspotRow) => ({ ...r, lat: round(r.lat), lon: round(r.lon) })),
        };
      case 'array':
      default:
        return data.map((r: HotspotRow) => ({ ...r, lat: round(r.lat), lon: round(r.lon) }));
    }
  }

  private invalidateStatsCache(): void {
    this.statsCache = null;
    this.statsCacheValid = false;
  }
}

// Singleton instance for server use
let controllerInstance: HotspotsController | null = null;

export function getHotspotsController(): HotspotsController {
  if (!controllerInstance) {
    controllerInstance = new HotspotsController();
  }
  return controllerInstance;
}

export function resetHotspotsController(): void {
  controllerInstance = new HotspotsController();
}