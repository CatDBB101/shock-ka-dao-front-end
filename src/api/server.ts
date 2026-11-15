import express, { type Request, type Response, type NextFunction, Router } from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

import {
  getHotspotsController,
  createFireCalendarApiClient,
  type FilterParams,
  type Watchpoint,
} from '../lib/hotspots';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// Error handler for JSON parsing
app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Invalid JSON in request body',
      code: 'BAD_REQUEST',
    });
  }
  next(err);
});

// Create API router with /api prefix
const apiRouter = Router();

// ==================== Health Check ====================

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'shock-ka-dao-hotspots-api',
  });
});

// ==================== Hotspots Endpoints ====================

/**
 * Parse query parameters into FilterParams
 */
function parseFilterParams(req: Request): FilterParams {
  const q = req.query;
  return {
    dateFrom: q.dateFrom as string | undefined,
    dateTo: q.dateTo as string | undefined,
    confidence: q.confidence ? (q.confidence as string).split(',') as any : undefined,
    minFrp: q.minFrp ? parseFloat(q.minFrp as string) : undefined,
    maxFrp: q.maxFrp ? parseFloat(q.maxFrp as string) : undefined,
    satellite: q.satellite ? (q.satellite as string).split(',') as any : undefined,
    daynight: q.daynight ? (q.daynight as string).split(',') as any : undefined,
    minLat: q.minLat ? parseFloat(q.minLat as string) : undefined,
    maxLat: q.maxLat ? parseFloat(q.maxLat as string) : undefined,
    minLon: q.minLon ? parseFloat(q.minLon as string) : undefined,
    maxLon: q.maxLon ? parseFloat(q.maxLon as string) : undefined,
    page: q.page ? parseInt(q.page as string, 10) : undefined,
    pageSize: q.pageSize ? parseInt(q.pageSize as string, 10) : undefined,
    format: q.format as any,
    includeStats: q.includeStats === 'true',
    simplifyCoords: q.simplifyCoords === 'true',
    coordPrecision: q.coordPrecision ? parseInt(q.coordPrecision as string, 10) : undefined,
  };
}

/**
 * GET /hotspots - Main endpoint with filtering, pagination, multiple formats
 */
apiRouter.get('/hotspots', (req: Request, res: Response) => {
  try {
    const controller = getHotspotsController();
    if (!controller.hasData()) {
      return res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: 'No data loaded. Call POST /hotspots/load first.',
        code: 'DATA_NOT_LOADED',
      });
    }

    const params = parseFilterParams(req);
    const result = controller.query(params);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      stats: result.stats,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'DATA_NOT_LOADED') {
      return res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: 'No data loaded. Call POST /hotspots/load first.',
        code: 'DATA_NOT_LOADED',
      });
    }
    console.error('Error in GET /hotspots:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /hotspots/stats - Statistics only
 */
apiRouter.get('/hotspots/stats', (req: Request, res: Response) => {
  try {
    const controller = getHotspotsController();
    if (!controller.hasData()) {
      return res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: 'No data loaded. Call POST /hotspots/load first.',
        code: 'DATA_NOT_LOADED',
      });
    }

    const params = parseFilterParams(req);
    const stats = controller.getStats(params);

    res.json({ success: true, data: stats });
  } catch (error) {
    if (error instanceof Error && error.message === 'DATA_NOT_LOADED') {
      return res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: 'No data loaded. Call POST /hotspots/load first.',
        code: 'DATA_NOT_LOADED',
      });
    }
    console.error('Error in GET /hotspots/stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /hotspots/timeseries - Time series data for charts
 */
apiRouter.get('/hotspots/timeseries', (req: Request, res: Response) => {
  try {
    const controller = getHotspotsController();
    if (!controller.hasData()) {
      return res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: 'No data loaded. Call POST /hotspots/load first.',
        code: 'DATA_NOT_LOADED',
      });
    }

    const params = parseFilterParams(req);
    const data = controller.getTimeSeries(params);

    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'DATA_NOT_LOADED') {
      return res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: 'No data loaded. Call POST /hotspots/load first.',
        code: 'DATA_NOT_LOADED',
      });
    }
    console.error('Error in GET /hotspots/timeseries:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /hotspots/geojson - GeoJSON for map rendering
 */
apiRouter.get('/hotspots/geojson', (req: Request, res: Response) => {
  try {
    const controller = getHotspotsController();
    if (!controller.hasData()) {
      return res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: 'No data loaded. Call POST /hotspots/load first.',
        code: 'DATA_NOT_LOADED',
      });
    }

    const params = parseFilterParams(req);
    // Force geojson format
    params.format = 'geojson';
    const data = controller.getGeoJSON(params);

    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'DATA_NOT_LOADED') {
      return res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: 'No data loaded. Call POST /hotspots/load first.',
        code: 'DATA_NOT_LOADED',
      });
    }
    console.error('Error in GET /hotspots/geojson:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /hotspots/load - Load CSV data synchronously
 */
apiRouter.post('/hotspots/load', (req: Request, res: Response) => {
  try {
    const { csv } = req.body;

    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'CSV data required in request body: { csv: string }',
        code: 'BAD_REQUEST',
      });
    }

    const controller = getHotspotsController();
    const result = controller.loadCsv(csv);

    res.json({
      success: true,
      message: `Loaded ${result.count} hotspot records`,
      count: result.count,
    });
  } catch (error) {
    console.error('Error in POST /hotspots/load:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Error',
      message: error instanceof Error ? error.message : 'Failed to load CSV',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /hotspots/load-async - Load large CSV asynchronously in batches
 */
apiRouter.post('/hotspots/load-async', async (req: Request, res: Response) => {
  try {
    const { csv, batchSize } = req.body;

    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'CSV data required in request body: { csv: string, batchSize?: number }',
        code: 'BAD_REQUEST',
      });
    }

    const controller = getHotspotsController();
    const result = await controller.loadCsvAsync(csv, batchSize || 10000);

    res.json({
      success: true,
      message: `Async load completed: ${result.totalRows} rows`,
      totalRows: result.totalRows,
    });
  } catch (error) {
    console.error('Error in POST /hotspots/load-async:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Error',
      message: error instanceof Error ? error.message : 'Failed to load CSV',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * DELETE /hotspots - Clear all loaded data
 */
apiRouter.delete('/hotspots', (_req: Request, res: Response) => {
  try {
    const controller = getHotspotsController();
    controller.clear();

    res.json({ success: true, message: 'Data cleared' });
  } catch (error) {
    console.error('Error in DELETE /hotspots:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Error',
      message: error instanceof Error ? error.message : 'Failed to clear data',
      code: 'INTERNAL_ERROR',
    });
  }
});

// ==================== Watchpoints Endpoint ====================

/**
 * GET /watchpoint - Get predefined watchpoints
 */
apiRouter.get('/watchpoint', (_req: Request, res: Response) => {
  try {
    const watchpointsPath = join(__dirname, '../../dist/watchpoints.json');
    const watchpointsData = JSON.parse(readFileSync(watchpointsPath, 'utf-8'));

    // Transform to API response format (only needed fields)
    const watchpoints: Watchpoint[] = watchpointsData.watchpoints.map((wp: any) => ({
      name: wp.name,
      country: wp.area?.split(', ').pop() || '',
      region: wp.region,
      lat: wp.lat,
      lon: wp.lon,
    }));

    res.json({ success: true, data: watchpoints });
  } catch (error) {
    console.error('Error in GET /watchpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Error',
      message: 'Failed to load watchpoints',
      code: 'INTERNAL_ERROR',
    });
  }
});

// ==================== FireCalendar Integration ====================

/**
 * POST /hotspots/download-and-load - Download from FireCalendar API and load
 * Convenience endpoint that combines download + load
 */
apiRouter.post('/hotspots/download-and-load', async (req: Request, res: Response) => {
  try {
    const {
      minLat,
      maxLat,
      minLon,
      maxLon,
      startDate,
      endDate,
      source = 'VIIRS_SNPP_SP',
    } = req.body;

    // Validate required params
    if (
      minLat === undefined || maxLat === undefined ||
      minLon === undefined || maxLon === undefined ||
      !startDate || !endDate
    ) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Required params: minLat, maxLat, minLon, maxLon, startDate, endDate',
        code: 'BAD_REQUEST',
      });
    }

    const box = { minLat, maxLat, minLon, maxLon };
    const client = createFireCalendarApiClient();

    // Check health first
    const healthy = await client.healthCheck();
    if (!healthy) {
      return res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: 'FireCalendar API is not reachable',
        code: 'FIRECALENDAR_UNAVAILABLE',
      });
    }

    // Download CSV
    const csv = await client.downloadHotspotsCsv(box, startDate, endDate, source);

    // Load into controller
    const controller = getHotspotsController();
    const result = controller.loadCsv(csv);

    res.json({
      success: true,
      message: `Downloaded and loaded ${result.count} hotspot records`,
      count: result.count,
    });
  } catch (error) {
    console.error('Error in POST /hotspots/download-and-load:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Error',
      message: error instanceof Error ? error.message : 'Failed to download and load',
      code: 'INTERNAL_ERROR',
    });
  }
});

// ==================== 404 Handler ====================

apiRouter.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: 'Route not found',
    code: 'NOT_FOUND',
  });
});

// ==================== Global Error Handler ====================

apiRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Error',
    message: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
  });
});

// Mount API router at /api
app.use('/api', apiRouter);

// ==================== Server Startup ====================

async function startServer() {
  // Auto-load sample data in development if FireCalendar API is available
  if (process.env.NODE_ENV !== 'production') {
    try {
      const client = createFireCalendarApiClient();
      const healthy = await client.healthCheck();
      if (healthy) {
        console.log('FireCalendar API is available, attempting auto-load...');
        // Try to load a default bounding box
        try {
          const csv = await client.downloadHotspotsCsv(
            { minLat: -35, maxLat: -32, minLon: -62, maxLon: -57 },
            '2024-01-01',
            '2024-01-31'
          );
          const controller = getHotspotsController();
          const result = controller.loadCsv(csv);
          console.log(`Auto-loaded ${result.count} hotspot records`);
        } catch (e) {
          console.log('Auto-load failed (using default bbox), will wait for manual load:', e);
        }
      } else {
        console.log('FireCalendar API not available, skipping auto-load');
      }
    } catch (e) {
      console.log('Auto-load check failed:', e);
    }
  }

  app.listen(PORT, () => {
    console.log(`🚀 Shock-KA DAO Hotspots API running on http://localhost:${PORT}/api`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log(`   Hotspots: http://localhost:${PORT}/api/hotspots`);
    console.log(`   Watchpoints: http://localhost:${PORT}/api/watchpoint`);
  });
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

startServer().catch(console.error);

export { app };