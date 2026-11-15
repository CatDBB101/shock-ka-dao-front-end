import { useState, useCallback, useEffect } from 'react';
import { useHotspots, useHotspotsGeoJSON, useHotspotsStats, useTimeSeries, useWatchpoints } from '../../lib/hotspots';
import type { FilterParams, HotspotRow, GeoJSONFeature } from '../../lib/hotspots';
import { Controls } from './Controls';
import { DataTable } from './DataTable';
import { TimeSeriesChart, BreakdownChart, StatsSummary } from './Charts';
import { MapView } from './MapView';
import { DataLoader } from './DataLoader';

interface HotspotsPageProps {
  initialFilters?: FilterParams;
}

export function HotspotsPage({ initialFilters = {} }: HotspotsPageProps) {
  const [filters, setFilters] = useState<FilterParams>({
    page: 1,
    pageSize: 100,
    format: 'array',
    includeStats: true,
    ...initialFilters,
  });
  const [activeTab, setActiveTab] = useState<'table' | 'map' | 'charts'>('table');
  const [selectedFeature, setSelectedFeature] = useState<GeoJSONFeature | null>(null);

  // Fetch data using React Query hooks
  const hotspotsQuery = useHotspots(filters);
  const geojsonQuery = useHotspotsGeoJSON(filters);
  const statsQuery = useHotspotsStats(filters);
  const timeSeriesQuery = useTimeSeries(filters);
  const watchpointsQuery = useWatchpoints();

  const data = hotspotsQuery.data?.data as HotspotRow[] | undefined;
  const pagination = hotspotsQuery.data?.pagination || null;
  const stats = statsQuery.data?.data;
  const timeSeries = timeSeriesQuery.data?.data;
  const geojson = geojsonQuery.data?.data ?? null;
  const watchpoints = watchpointsQuery.data?.data || [];

  const isLoading = hotspotsQuery.isLoading || statsQuery.isLoading || timeSeriesQuery.isLoading;

  const handleFiltersChange = useCallback((newFilters: FilterParams) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const handlePageSizeChange = useCallback((pageSize: number) => {
    setFilters((prev) => ({ ...prev, pageSize, page: 1 }));
  }, []);

  const handleDataLoaded = useCallback(async () => {
    // Data will be refetched automatically via React Query invalidation
  }, []);

  const handleDataCleared = useCallback(() => {
    setFilters((prev) => ({ ...prev, page: 1 }));
  }, []);

  // Handle feature click from map
  const handleFeatureClick = useCallback((feature: GeoJSONFeature) => {
    setSelectedFeature(feature);
  }, []);

  // Reset page when filters change (except page/pageSize)
  useEffect(() => {
    if (filters.page !== 1) {
      setFilters((prev) => ({ ...prev, page: 1 }));
    }
  }, [filters.dateFrom, filters.dateTo, filters.confidence, filters.satellite, filters.daynight, filters.minFrp, filters.maxFrp, filters.minLat, filters.maxLat, filters.minLon, filters.maxLon]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Hotspots Dashboard</h1>
              <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                Shock-KA DAO
              </span>
            </div>
            <div className="flex items-center gap-3">
              {hotspotsQuery.data && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {hotspotsQuery.data.pagination?.totalItems?.toLocaleString() || data?.length || 0} จุดไฟ
                </span>
              )}
              {isLoading && (
                <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-1" aria-label="Tabs">
            {[
              { id: 'table', label: 'ตารางข้อมูล', icon: '📋' },
              { id: 'map', label: 'แผนที่', icon: '🗺️' },
              { id: 'charts', label: 'กราฟ', icon: '📊' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span>{tab.icon}</span>
                  {tab.label}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Stats Summary */}
        {stats && <StatsSummary stats={stats} />}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Controls */}
          <aside className="lg:col-span-1">
            <Controls
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onLoadData={handleDataLoaded}
              onClearData={handleDataCleared}
              isLoading={isLoading}
              hasData={!!data && data.length > 0}
              totalCount={hotspotsQuery.data?.pagination?.totalItems || data?.length || 0}
            />

            <DataLoader
              onDataLoaded={handleDataLoaded}
              onDataCleared={handleDataCleared}
            />
          </aside>

          {/* Main Panel */}
          <main className="lg:col-span-3 space-y-6">
            {/* Table Tab */}
            {activeTab === 'table' && (
              <DataTable
                data={data || []}
                pagination={pagination}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                loading={hotspotsQuery.isLoading}
              />
            )}

            {/* Map Tab */}
            {activeTab === 'map' && (
              <MapView
                geojson={geojson}
                watchpoints={watchpoints}
                onFeatureClick={handleFeatureClick}
              />
            )}

            {/* Charts Tab */}
            {activeTab === 'charts' && (
              <div className="space-y-6">
                <TimeSeriesChart data={timeSeries || []} />
                {stats && <BreakdownChart stats={stats} />}
              </div>
            )}

            {/* Error States */}
            {hotspotsQuery.error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
                <p className="font-medium">เกิดข้อผิดพลาดในการโหลดข้อมูล:</p>
                <p className="text-sm mt-1">{hotspotsQuery.error.message}</p>
                <button
                  onClick={() => hotspotsQuery.refetch()}
                  className="mt-2 text-sm underline hover:no-underline"
                >
                  ลองใหม่อีกครั้ง
                </button>
              </div>
            )}

            {geojsonQuery.error && activeTab === 'map' && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
                <p className="font-medium">ไม่สามารถโหลดข้อมูลแผนที่ได้:</p>
                <p className="text-sm mt-1">{geojsonQuery.error.message}</p>
              </div>
            )}

            {statsQuery.error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
                <p className="font-medium">ไม่สามารถโหลดสถิติได้:</p>
                <p className="text-sm mt-1">{statsQuery.error.message}</p>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Feature Detail Modal */}
      {selectedFeature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedFeature(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">รายละเอียดจุดไฟ</h3>
              <button onClick={() => setSelectedFeature(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-gray-500 dark:text-gray-400">วันที่</dt>
                <dd className="font-mono text-gray-900 dark:text-white">{selectedFeature.properties.date}</dd>
                <dt className="text-gray-500 dark:text-gray-400">เวลา</dt>
                <dd className="font-mono text-gray-900 dark:text-white">{selectedFeature.properties.time}</dd>
                <dt className="text-gray-500 dark:text-gray-400">Latitude</dt>
                <dd className="font-mono text-gray-900 dark:text-white">{selectedFeature.properties.lat.toFixed(6)}</dd>
                <dt className="text-gray-500 dark:text-gray-400">Longitude</dt>
                <dd className="font-mono text-gray-900 dark:text-white">{selectedFeature.properties.lon.toFixed(6)}</dd>
                <dt className="text-gray-500 dark:text-gray-400">ความเชื่อมั่น</dt>
                <dd className="capitalize text-gray-900 dark:text-white">{selectedFeature.properties.confidence}</dd>
                <dt className="text-gray-500 dark:text-gray-400">FRP (MW)</dt>
                <dd className="font-mono text-gray-900 dark:text-white">{selectedFeature.properties.frp.toFixed(1)}</dd>
                <dt className="text-gray-500 dark:text-gray-400">ดาวเทียม</dt>
                <dd className="text-gray-900 dark:text-white">{selectedFeature.properties.satellite}</dd>
                <dt className="text-gray-500 dark:text-gray-400">เครื่องมือ</dt>
                <dd className="text-gray-900 dark:text-white">{selectedFeature.properties.instrument}</dd>
                <dt className="text-gray-500 dark:text-gray-400">วัน/คืน</dt>
                <dd className="text-gray-900 dark:text-white">{selectedFeature.properties.daynight === 'D' ? 'กลางวัน' : 'กลางคืน'}</dd>
                <dt className="text-gray-500 dark:text-gray-400">ความสว่าง (K)</dt>
                <dd className="font-mono text-gray-900 dark:text-white">{selectedFeature.properties.brightness.toFixed(1)}</dd>
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}