import { useState, useCallback } from 'react';
import type { FilterParams, ConfidenceLevel, Satellite, DayNight, OutputFormat } from '../../lib/hotspots';

interface ControlsProps {
  filters: FilterParams;
  onFiltersChange: (filters: FilterParams) => void;
  onLoadData: () => Promise<void>;
  onClearData: () => void;
  isLoading: boolean;
  hasData: boolean;
  totalCount: number;
}

export function Controls({
  filters,
  onFiltersChange,
  onLoadData,
  onClearData,
  isLoading,
  hasData,
  totalCount,
}: ControlsProps) {
  const [dateFrom, setDateFrom] = useState(filters.dateFrom || '');
  const [dateTo, setDateTo] = useState(filters.dateTo || '');
  const [minFrp, setMinFrp] = useState(filters.minFrp?.toString() || '');
  const [maxFrp, setMaxFrp] = useState(filters.maxFrp?.toString() || '');
  const [confidence, setConfidence] = useState<ConfidenceLevel[]>(
    filters.confidence || []
  );
  const [satellite, setSatellite] = useState<Satellite[]>(
    filters.satellite || []
  );
  const [daynight, setDayNight] = useState<DayNight[]>(
    filters.daynight || []
  );
  const [format, setFormat] = useState<OutputFormat>(filters.format || 'array');

  const updateFilters = useCallback(
    (newFilters: Partial<FilterParams>) => {
      onFiltersChange({ ...filters, ...newFilters });
    },
    [filters, onFiltersChange]
  );

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDateFrom(value);
    updateFilters({ dateFrom: value || undefined });
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDateTo(value);
    updateFilters({ dateTo: value || undefined });
  };

  const handleMinFrpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMinFrp(value);
    updateFilters({ minFrp: value ? parseFloat(value) : undefined });
  };

  const handleMaxFrpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMaxFrp(value);
    updateFilters({ maxFrp: value ? parseFloat(value) : undefined });
  };

  const toggleConfidence = (level: ConfidenceLevel) => {
    const newConfidence = confidence.includes(level)
      ? confidence.filter((c) => c !== level)
      : [...confidence, level];
    setConfidence(newConfidence);
    updateFilters({ confidence: newConfidence.length ? newConfidence : undefined });
  };

  const toggleSatellite = (sat: Satellite) => {
    const newSatellite = satellite.includes(sat)
      ? satellite.filter((s) => s !== sat)
      : [...satellite, sat];
    setSatellite(newSatellite);
    updateFilters({ satellite: newSatellite.length ? newSatellite : undefined });
  };

  const toggleDayNight = (dn: DayNight) => {
    const newDayNight = daynight.includes(dn)
      ? daynight.filter((d) => d !== dn)
      : [...daynight, dn];
    setDayNight(newDayNight);
    updateFilters({ daynight: newDayNight.length ? newDayNight : undefined });
  };

  const handleFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as OutputFormat;
    setFormat(value);
    updateFilters({ format: value });
  };

  const handleReset = () => {
    setDateFrom('');
    setDateTo('');
    setMinFrp('');
    setMaxFrp('');
    setConfidence([]);
    setSatellite([]);
    setDayNight([]);
    setFormat('array');
    onFiltersChange({});
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          ตัวกรองข้อมูล
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {hasData ? `${totalCount.toLocaleString()} รายการ` : 'ไม่มีข้อมูล'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            วันที่เริ่มต้น
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={handleDateFromChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
              bg-white dark:bg-gray-700 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            วันที่สิ้นสุด
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={handleDateToChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
              bg-white dark:bg-gray-700 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* FRP Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            FRP ขั้นต่ำ (MW)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={minFrp}
            onChange={handleMinFrpChange}
            placeholder="0"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
              bg-white dark:bg-gray-700 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            FRP สูงสุด (MW)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={maxFrp}
            onChange={handleMaxFrpChange}
            placeholder="ไม่จำกัด"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
              bg-white dark:bg-gray-700 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Confidence */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            ระดับความเชื่อมั่น
          </label>
          <div className="flex flex-wrap gap-2">
            {(['low', 'nominal', 'high'] as ConfidenceLevel[]).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => toggleConfidence(level)}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors
                  ${confidence.includes(level)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
              >
                {level === 'low' ? 'ต่ำ' : level === 'nominal' ? 'ปานกลาง' : 'สูง'}
              </button>
            ))}
          </div>
        </div>

        {/* Satellite */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            ดาวเทียม
          </label>
          <div className="flex flex-wrap gap-2">
            {(['SNPP', 'NOAA20', 'NOAA21', 'AQUA', 'TERRA'] as Satellite[]).map((sat) => (
              <button
                key={sat}
                type="button"
                onClick={() => toggleSatellite(sat)}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors
                  ${satellite.includes(sat)
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
              >
                {sat}
              </button>
            ))}
          </div>
        </div>

        {/* Day/Night */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            กลางวัน/กลางคืน
          </label>
          <div className="flex flex-wrap gap-2">
            {(['D', 'N'] as DayNight[]).map((dn) => (
              <button
                key={dn}
                type="button"
                onClick={() => toggleDayNight(dn)}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors
                  ${daynight.includes(dn)
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
              >
                {dn === 'D' ? 'กลางวัน' : 'กลางคืน'}
              </button>
            ))}
          </div>
        </div>

        {/* Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            รูปแบบข้อมูล
          </label>
          <select
            value={format}
            onChange={handleFormatChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
              bg-white dark:bg-gray-700 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="array">Array (JSON)</option>
            <option value="geojson">GeoJSON</option>
            <option value="grouped-by-date">จัดกลุ่มตามวันที่</option>
            <option value="grouped-by-confidence">จัดกลุ่มตามความเชื่อมั่น</option>
            <option value="timeseries">Time Series</option>
          </select>
        </div>

        {/* Bounding Box */}
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            พื้นที่ (Bounding Box)
          </label>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Min Lat</label>
              <input
                type="number"
                step="0.0001"
                value={filters.minLat?.toString() || ''}
                onChange={(e) =>
                  updateFilters({ minLat: e.target.value ? parseFloat(e.target.value) : undefined })
                }
                placeholder="-90"
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm
                  focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Max Lat</label>
              <input
                type="number"
                step="0.0001"
                value={filters.maxLat?.toString() || ''}
                onChange={(e) =>
                  updateFilters({ maxLat: e.target.value ? parseFloat(e.target.value) : undefined })
                }
                placeholder="90"
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm
                  focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Min Lon</label>
              <input
                type="number"
                step="0.0001"
                value={filters.minLon?.toString() || ''}
                onChange={(e) =>
                  updateFilters({ minLon: e.target.value ? parseFloat(e.target.value) : undefined })
                }
                placeholder="-180"
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm
                  focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Max Lon</label>
              <input
                type="number"
                step="0.0001"
                value={filters.maxLon?.toString() || ''}
                onChange={(e) =>
                  updateFilters({ maxLon: e.target.value ? parseFloat(e.target.value) : undefined })
                }
                placeholder="180"
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm
                  focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Pagination */}
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Pagination
          </label>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">หน้า</label>
              <input
                type="number"
                min="1"
                value={filters.page?.toString() || '1'}
                onChange={(e) =>
                  updateFilters({ page: e.target.value ? parseInt(e.target.value, 10) : undefined })
                }
                className="w-24 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm
                  focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">ขนาดหน้า</label>
              <input
                type="number"
                min="1"
                max="10000"
                value={filters.pageSize?.toString() || '100'}
                onChange={(e) =>
                  updateFilters({ pageSize: e.target.value ? parseInt(e.target.value, 10) : undefined })
                }
                className="w-32 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm
                  focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Advanced Options */}
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            ตัวเลือกขั้นสูง
          </label>
          <div className="flex flex-wrap gap-4 items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.includeStats || false}
                onChange={(e) => updateFilters({ includeStats: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">รวมสถิติ</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.simplifyCoords || false}
                onChange={(e) => updateFilters({ simplifyCoords: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">ลดพิกัด</span>
            </label>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">ความแม่นยำพิกัด</label>
              <input
                type="number"
                min="1"
                max="10"
                value={filters.coordPrecision?.toString() || '6'}
                onChange={(e) =>
                  updateFilters({ coordPrecision: e.target.value ? parseInt(e.target.value, 10) : undefined })
                }
                className="w-24 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm
                  focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onLoadData}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors
            flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              กำลังโหลด...
            </>
          ) : (
            'โหลดข้อมูลจาก FireCalendar API'
          )}
        </button>

        <button
          onClick={onClearData}
          disabled={!hasData || isLoading}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ล้างข้อมูล
        </button>

        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300
            rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          รีเซ็ตตัวกรอง
        </button>
      </div>
    </div>
  );
}