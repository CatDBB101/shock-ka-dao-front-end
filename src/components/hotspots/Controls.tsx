import { useState, useMemo } from 'react';
import type { FilterParams, ConfidenceLevel, Satellite, DayNight } from '../../lib/hotspots/types';

interface ControlsProps {
  filters: FilterParams;
  onFiltersChange: (filters: FilterParams) => void;
  stats?: {
    dateRange: { from: string; to: string } | null;
    confidenceBreakdown: { low: number; nominal: number; high: number };
    satelliteBreakdown: Record<string, number>;
    daynightBreakdown: { D: number; N: number };
  };
  loading?: boolean;
  className?: string;
}

const CONFIDENCE_OPTIONS: ConfidenceLevel[] = ['high', 'nominal', 'low'];
const DAYNIGHT_OPTIONS: DayNight[] = ['D', 'N'];

export function Controls({
  filters,
  onFiltersChange,
  stats,
  loading = false,
  className = '',
}: ControlsProps) {
  const [expanded, setExpanded] = useState(false);
  const [dateFrom, setDateFrom] = useState(filters.dateFrom || '');
  const [dateTo, setDateTo] = useState(filters.dateTo || '');
  const [minFrp, setMinFrp] = useState(filters.minFrp?.toString() || '');
  const [maxFrp, setMaxFrp] = useState(filters.maxFrp?.toString() || '');
  const [minLat, setMinLat] = useState(filters.minLat?.toString() || '');
  const [maxLat, setMaxLat] = useState(filters.maxLat?.toString() || '');
  const [minLon, setMinLon] = useState(filters.minLon?.toString() || '');
  const [maxLon, setMaxLon] = useState(filters.maxLon?.toString() || '');
  const [confidence, setConfidence] = useState<ConfidenceLevel[]>(filters.confidence || []);
  const [satellite, setSatellite] = useState<Satellite[]>(filters.satellite || []);
  const [daynight, setDayNight] = useState<DayNight[]>(filters.daynight || []);

  // Available satellites from stats
  const availableSatellites = useMemo(
    () => Object.keys(stats?.satelliteBreakdown || {}).filter(Boolean) as Satellite[],
    [stats?.satelliteBreakdown]
  );

  const handleApply = () => {
    const newFilters: FilterParams = {
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      confidence: confidence.length > 0 ? confidence : undefined,
      minFrp: minFrp ? parseFloat(minFrp) : undefined,
      maxFrp: maxFrp ? parseFloat(maxFrp) : undefined,
      satellite: satellite.length > 0 ? satellite : undefined,
      daynight: daynight.length > 0 ? daynight : undefined,
      minLat: minLat ? parseFloat(minLat) : undefined,
      maxLat: maxLat ? parseFloat(maxLat) : undefined,
      minLon: minLon ? parseFloat(minLon) : undefined,
      maxLon: maxLon ? parseFloat(maxLon) : undefined,
      page: 1, // Reset to first page when filters change
    };
    onFiltersChange(newFilters);
  };

  const handleReset = () => {
    setDateFrom('');
    setDateTo('');
    setMinFrp('');
    setMaxFrp('');
    setMinLat('');
    setMaxLat('');
    setMinLon('');
    setMaxLon('');
    setConfidence([]);
    setSatellite([]);
    setDayNight([]);
    onFiltersChange({ page: 1 });
  };

  const hasActiveFilters = useMemo(() => {
    return !!(
      dateFrom || dateTo ||
      confidence.length > 0 ||
      minFrp || maxFrp ||
      satellite.length > 0 ||
      daynight.length > 0 ||
      minLat || maxLat || minLon || maxLon
    );
  }, [dateFrom, dateTo, confidence, minFrp, maxFrp, satellite, daynight, minLat, maxLat, minLon, maxLon]);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
        >
          {expanded ? 'Hide advanced' : 'Show advanced'}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={expanded ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
          </svg>
        </button>
      </div>

      {/* Basic Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            max={dateTo || undefined}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min={dateFrom || undefined}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confidence</label>
          <div className="flex flex-wrap gap-1">
            {CONFIDENCE_OPTIONS.map((c) => (
              <label key={c} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confidence.includes(c)}
                  onChange={(e) => setConfidence(e.target.checked ? [...confidence, c] : confidence.filter((x) => x !== c))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm capitalize">{c}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Day/Night</label>
          <div className="flex flex-wrap gap-1">
            {DAYNIGHT_OPTIONS.map((d) => (
              <label key={d} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={daynight.includes(d)}
                  onChange={(e) => setDayNight(e.target.checked ? [...daynight, d] : daynight.filter((x) => x !== d))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">{d === 'D' ? 'Day' : 'Night'}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4 animate-slide-down">
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">FRP Range (MW)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min FRP</label>
                <input
                  type="number"
                  step="0.1"
                  value={minFrp}
                  onChange={(e) => setMinFrp(e.target.value)}
                  placeholder="e.g., 10"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max FRP</label>
                <input
                  type="number"
                  step="0.1"
                  value={maxFrp}
                  onChange={(e) => setMaxFrp(e.target.value)}
                  placeholder="e.g., 500"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bounding Box</h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Lat</label>
                <input
                  type="number"
                  step="0.0001"
                  value={minLat}
                  onChange={(e) => setMinLat(e.target.value)}
                  placeholder="-90"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Lat</label>
                <input
                  type="number"
                  step="0.0001"
                  value={maxLat}
                  onChange={(e) => setMaxLat(e.target.value)}
                  placeholder="90"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Lon</label>
                <input
                  type="number"
                  step="0.0001"
                  value={minLon}
                  onChange={(e) => setMinLon(e.target.value)}
                  placeholder="-180"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Lon</label>
                <input
                  type="number"
                  step="0.0001"
                  value={maxLon}
                  onChange={(e) => setMaxLon(e.target.value)}
                  placeholder="180"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Satellites</h4>
            <div className="flex flex-wrap gap-2">
              {availableSatellites.map((sat) => (
                <label key={sat} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={satellite.includes(sat)}
                    onChange={(e) => setSatellite(e.target.checked ? [...satellite, sat] : satellite.filter((x) => x !== sat))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">{sat}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleApply}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Applying...' : 'Apply Filters'}
        </button>
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

// Export filter options for reuse
export { CONFIDENCE_OPTIONS, DAYNIGHT_OPTIONS };