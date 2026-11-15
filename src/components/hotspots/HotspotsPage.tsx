import { useState, useCallback } from 'react';
import { useHotspots, useHotspotsGeoJSON, useHotspotsStats, useTimeSeries, useWatchpoints } from '../../lib/hotspots/hooks';
import type { FilterParams, HotspotRow, TimeSeriesPoint, GeoJSONFeatureCollection } from '../../lib/hotspots/types';
import { MapView, MapLegend, FeaturePopup } from './MapView';
import { TimeSeriesChart, ConfidenceBreakdownChart, SatelliteBreakdownChart, DayNightChart, StatsGrid } from './Charts';
import { DataTable } from './DataTable';
import { Controls } from './Controls';
import { DataLoader } from './DataLoader';

export function HotspotsPage() {
  const [filters, setFilters] = useState<FilterParams>({
    dateFrom: '2024-01-01',
    dateTo: '2024-01-31',
    page: 1,
    pageSize: 50,
  });
  const [selectedFeature, setSelectedFeature] = useState<GeoJSONFeatureCollection['features'][0] | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'table' | 'charts'>('map');

  // Fetch data
  const { data: hotspotsData, isLoading: hotspotsLoading, error: hotspotsError, refetch: refetchHotspots } = useHotspots({
    ...filters,
    format: 'array',
    includeStats: true,
  });

  const { data: geojsonData, isLoading: geojsonLoading } = useHotspotsGeoJSON(filters);
  const { data: statsData, isLoading: statsLoading } = useHotspotsStats(filters);
  const { data: timeSeriesData, isLoading: timeSeriesLoading } = useTimeSeries(filters);
  const { data: watchpointsData } = useWatchpoints();

  // Extract data
  const hotspots = hotspotsData?.data as HotspotRow[] | undefined;
  const pagination = hotspotsData?.pagination;
  const stats = statsData?.data;
  const timeSeries = timeSeriesData?.data as TimeSeriesPoint[] | undefined;
  const geojson = (geojsonData?.data as GeoJSONFeatureCollection | undefined) ?? null;
  const watchpoints = watchpointsData?.data;

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  // Handle filter change
  const handleFiltersChange = useCallback((newFilters: FilterParams) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  }, []);

  // Handle data loaded
  const handleDataLoaded = useCallback(() => {
    refetchHotspots();
  }, [refetchHotspots]);

  const isLoading = hotspotsLoading || geojsonLoading || statsLoading || timeSeriesLoading;

  // Summary stats for header
  const totalCount = hotspots?.length || stats?.totalCount || 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Hotspots Explorer</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Fire hotspots data visualization and analysis
              </p>
            </div>
            <div className="flex items-center gap-3">
              <DataLoader onDataLoaded={handleDataLoaded} />
              {totalCount > 0 && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    {totalCount.toLocaleString()} hotspots
                  </span>
                  {pagination && (
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-1" aria-label="View tabs">
            <button
              onClick={() => setActiveTab('map')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'map'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              🗺️ Map
            </button>
            <button
              onClick={() => setActiveTab('table')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'table'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              📋 Table
            </button>
            <button
              onClick={() => setActiveTab('charts')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'charts'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              📊 Charts
            </button>
          </nav>
        </div>

        {/* Error State */}
        {hotspotsError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-red-700 dark:text-red-300">Error: {hotspotsError.message}</span>
              </div>
              <button
                onClick={() => refetchHotspots()}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !hotspots && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg className="animate-spin h-10 w-10 mx-auto text-blue-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="mt-3 text-gray-600 dark:text-gray-400">Loading hotspots data...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !hotspotsError && (!hotspots || hotspots.length === 0) && (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No hotspots found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Load data using the <strong>Load Data</strong> panel or adjust your filters.
            </p>
            <DataLoader onDataLoaded={handleDataLoaded} />
          </div>
        )}

        {/* Content */}
        {!isLoading && !hotspotsError && hotspots && hotspots.length > 0 && (
          <>
            {/* Map Tab */}
            {activeTab === 'map' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar */}
                <aside className="lg:col-span-1 space-y-6">
                  <Controls
                    filters={filters}
                    onFiltersChange={handleFiltersChange}
                    stats={stats || undefined}
                    loading={isLoading}
                  />

                  {stats && <StatsGrid stats={stats} />}

                  {timeSeries && timeSeries.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Time Series</h4>
                      <TimeSeriesChart data={timeSeries} height={250} showHotspots showFRP />
                    </div>
                  )}

                  {stats && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Confidence Breakdown</h4>
                      <ConfidenceBreakdownChart data={stats.confidenceBreakdown} height={220} />
                    </div>
                  )}

                  {stats && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Day / Night</h4>
                      <DayNightChart day={stats.daynightBreakdown.D} night={stats.daynightBreakdown.N} height={180} />
                    </div>
                  )}
                </aside>

                {/* Map */}
                <div className="lg:col-span-3 h-[calc(100vh-300px)] min-h-[500px]">
                  <div className="relative h-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                    <MapView
                      geojson={geojson}
                      watchpoints={watchpoints || []}
                      onFeatureClick={setSelectedFeature}
                    />
                    <MapLegend showHotspots={!!geojson} showWatchpoints={!!watchpoints?.length} />
                  </div>
                </div>
              </div>
            )}

            {/* Table Tab */}
            {activeTab === 'table' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <aside className="lg:col-span-1">
                  <Controls
                    filters={filters}
                    onFiltersChange={handleFiltersChange}
                    stats={stats || undefined}
                    loading={isLoading}
                  />
                </aside>
                <div className="lg:col-span-3">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          Hotspots Data ({hotspots.length.toLocaleString()} records)
                        </h3>
                        {pagination && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Page {pagination.page} of {pagination.totalPages} · {pagination.totalItems.toLocaleString()} total
                          </span>
                        )}
                      </div>
                    </div>
                    <DataTable
                      data={hotspots}
                      pageSize={filters.pageSize || 50}
                      onPageChange={handlePageChange}
                      onRowClick={(row) => {
                        const feature = geojson?.features.find(
                          (f) => f.properties.lat === row.lat && f.properties.lon === row.lon
                        );
                        if (feature) setSelectedFeature(feature);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Charts Tab */}
            {activeTab === 'charts' && stats && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <aside className="lg:col-span-1">
                  <Controls
                    filters={filters}
                    onFiltersChange={handleFiltersChange}
                    stats={stats}
                    loading={isLoading}
                  />
                </aside>
                <div className="lg:col-span-3 space-y-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Time Series</h3>
                    {timeSeries && timeSeries.length > 0 ? (
                      <TimeSeriesChart
                        data={timeSeries}
                        height={350}
                        showHotspots
                        showFRP
                        showAvgFRP
                        showMaxFRP
                      />
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-8">No time series data available</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Confidence Breakdown</h3>
                      <ConfidenceBreakdownChart data={stats.confidenceBreakdown} height={300} />
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Satellites</h3>
                      <SatelliteBreakdownChart data={stats.satelliteBreakdown} height={300} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Day / Night</h3>
                      <DayNightChart day={stats.daynightBreakdown.D} night={stats.daynightBreakdown.N} height={300} />
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">FRP Statistics</h3>
                      <div className="space-y-3">
                        <StatRow label="Min FRP" value={`${stats.frpStats.min.toFixed(1)} MW`} />
                        <StatRow label="Max FRP" value={`${stats.frpStats.max.toFixed(1)} MW`} />
                        <StatRow label="Average FRP" value={`${stats.frpStats.avg.toFixed(1)} MW`} />
                        <StatRow label="Total FRP" value={`${stats.frpStats.sum.toFixed(1)} MW`} />
                        {stats.bbox && (
                          <>
                            <StatRow label="Lat Range" value={`${stats.bbox.minLat.toFixed(4)} to ${stats.bbox.maxLat.toFixed(4)}`} />
                            <StatRow label="Lon Range" value={`${stats.bbox.minLon.toFixed(4)} to ${stats.bbox.maxLon.toFixed(4)}`} />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Feature Popup */}
        {selectedFeature && (
          <FeaturePopup
            feature={selectedFeature}
            onClose={() => setSelectedFeature(null)}
          />
        )}
      </main>
    </div>
  );
}

// Simple stat row component
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span className="font-mono font-medium text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}