import type { Box } from '../firecalendar/types';
import type { FirmsSource } from '../firecalendar/types';

const DEFAULT_FIRECALENDAR_API = 'https://api.firefirm.site';

export interface FireCalendarApiConfig {
  baseUrl: string;
  timeout?: number;
}

/**
 * FireCalendar API Client
 * Only component that makes HTTP requests to the external FireCalendar API
 * Downloads CSV data for hotspots
 */
export class FireCalendarApiClient {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: FireCalendarApiConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.timeout = config.timeout || 60000; // 60 seconds default
  }

  /**
   * Build the hotspots CSV URL with query parameters
   */
  buildHotspotsCsvUrl(
    box: Box,
    startDate: string,
    endDate: string,
    source: FirmsSource = 'VIIRS_SNPP_SP'
  ): string {
    const params = new URLSearchParams();
    params.set('min_lat', String(box.minLat));
    params.set('max_lat', String(box.maxLat));
    params.set('min_lon', String(box.minLon));
    params.set('max_lon', String(box.maxLon));
    params.set('start', startDate);
    params.set('end', endDate);
    params.set('source', source);

    return `${this.baseUrl}/v1/hotspots.csv?${params.toString()}`;
  }

  /**
   * Download hotspots CSV from FireCalendar API
   */
  async downloadHotspotsCsv(
    box: Box,
    startDate: string,
    endDate: string,
    source: FirmsSource = 'VIIRS_SNPP_SP'
  ): Promise<string> {
    const url = this.buildHotspotsCsvUrl(box, startDate, endDate, source);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'text/csv',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `FireCalendar API error (${response.status}): ${errorText}`
        );
      }

      return await response.text();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`FireCalendar API request timed out after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Health check for FireCalendar API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Create a FireCalendar API client from environment config
 * Works in both Vite (import.meta.env) and Node.js (process.env)
 */
export function createFireCalendarApiClient(): FireCalendarApiClient {
  let baseUrl = DEFAULT_FIRECALENDAR_API;

  // Check Node.js env (server) - process.env is always available in Node
  if (typeof process !== 'undefined' && process.env?.FIRECALENDAR_API_URL) {
    baseUrl = process.env.FIRECALENDAR_API_URL;
  }
  // Check Vite env (browser/build) - import.meta.env only available in Vite context
  else if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIRECALENDAR_API) {
    baseUrl = import.meta.env.VITE_FIRECALENDAR_API;
  }

  return new FireCalendarApiClient({ baseUrl });
}