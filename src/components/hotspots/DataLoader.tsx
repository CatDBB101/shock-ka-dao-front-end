import { useState, useCallback } from 'react';
import { useLoadHotspots, useLoadHotspotsAsync, useDownloadAndLoad, useClearHotspots, useHealth } from '../../lib/hotspots';
import type { LoadResponse } from '../../lib/hotspots';

interface DataLoaderProps {
  onDataLoaded?: (result: LoadResponse) => void;
  onDataCleared?: () => void;
  defaultBbox?: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  defaultDateRange?: { startDate: string; endDate: string };
  defaultSource?: string;
}

export function DataLoader({
  onDataLoaded,
  onDataCleared,
  defaultBbox = { minLat: -35, maxLat: -32, minLon: -62, maxLon: -57 },
  defaultDateRange = { startDate: '2024-01-01', endDate: '2024-01-31' },
  defaultSource = 'SNPP',
}: DataLoaderProps) {
  const { data: health } = useHealth();
  const loadCsv = useLoadHotspots();
  const loadCsvAsync = useLoadHotspotsAsync();
  const downloadAndLoad = useDownloadAndLoad();
  const clearHotspots = useClearHotspots();

  const [method, setMethod] = useState<'csv' | 'async' | 'download'>('download');

  const handleMethodChange = useCallback((value: 'csv' | 'async' | 'download') => {
    setMethod(value);
  }, []);
  const [csvText, setCsvText] = useState('');
  const [batchSize, setBatchSize] = useState(10000);
  const [bbox, setBbox] = useState(defaultBbox);
  const [dateRange, setDateRange] = useState(defaultDateRange);
  const [source, setSource] = useState(defaultSource);
  const [lastResult, setLastResult] = useState<LoadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLoadCsv = useCallback(async () => {
    if (!csvText.trim()) {
      setError('กรุณาใส่ข้อมูล CSV');
      return;
    }
    setError(null);
    try {
      const result = await loadCsv.mutateAsync(csvText);
      setLastResult(result);
      onDataLoaded?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  }, [csvText, loadCsv, onDataLoaded]);

  const handleLoadCsvAsync = useCallback(async () => {
    if (!csvText.trim()) {
      setError('กรุณาใส่ข้อมูล CSV');
      return;
    }
    setError(null);
    try {
      const result = await loadCsvAsync.mutateAsync({ csv: csvText, batchSize });
      setLastResult(result);
      onDataLoaded?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  }, [csvText, batchSize, loadCsvAsync, onDataLoaded]);

  const handleDownloadAndLoad = useCallback(async () => {
    setError(null);
    try {
      const result = await downloadAndLoad.mutateAsync({
        minLat: bbox.minLat,
        maxLat: bbox.maxLat,
        minLon: bbox.minLon,
        maxLon: bbox.maxLon,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        source,
      });
      setLastResult(result);
      onDataLoaded?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  }, [bbox, dateRange, source, downloadAndLoad, onDataLoaded]);

  const handleClear = useCallback(async () => {
    setError(null);
    try {
      await clearHotspots.mutateAsync();
      setLastResult(null);
      onDataCleared?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  }, [clearHotspots, onDataCleared]);

  const isLoading = loadCsv.isPending || loadCsvAsync.isPending || downloadAndLoad.isPending || clearHotspots.isPending;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">จัดการข้อมูล</h3>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${health?.status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {health?.status === 'ok' ? 'API พร้อมใช้งาน' : 'API ไม่พร้อม'}
          </span>
        </div>
      </div>

      {/* Method Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          วิธีการโหลดข้อมูล
        </label>
        <div className="flex flex-wrap gap-2">
          {([
            { value: 'download', label: 'ดาวน์โหลดจาก FireCalendar API', desc: 'โหลดโดยระบุพื้นที่และช่วงเวลา' },
            { value: 'csv', label: 'โหลดจากไฟล์ CSV (Sync)', desc: 'เหมาะสำหรับข้อมูลน้อยกว่า 10k แถว' },
            { value: 'async', label: 'โหลดจากไฟล์ CSV (Async)', desc: 'เหมาะสำหรับข้อมูลมาก ใช้ batch processing' },
          ] as const).map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => handleMethodChange(m.value)}
              className={`px-4 py-2 rounded-lg border-2 text-left transition-colors ${
                method === m.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="font-medium">{m.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Download from FireCalendar */}
      {method === 'download' && (
        <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <h4 className="font-medium text-gray-900 dark:text-white">ดาวน์โหลดจาก FireCalendar API</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Min Lat</label>
              <input
                type="number"
                step="0.0001"
                value={bbox.minLat}
                onChange={(e) => setBbox({ ...bbox, minLat: parseFloat(e.target.value) })}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Max Lat</label>
              <input
                type="number"
                step="0.0001"
                value={bbox.maxLat}
                onChange={(e) => setBbox({ ...bbox, maxLat: parseFloat(e.target.value) })}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Min Lon</label>
              <input
                type="number"
                step="0.0001"
                value={bbox.minLon}
                onChange={(e) => setBbox({ ...bbox, minLon: parseFloat(e.target.value) })}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Max Lon</label>
              <input
                type="number"
                step="0.0001"
                value={bbox.maxLon}
                onChange={(e) => setBbox({ ...bbox, maxLon: parseFloat(e.target.value) })}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Data Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
              >
                <option value="SNPP">SNPP (VIIRS)</option>
                <option value="NOAA20">NOAA-20 (VIIRS)</option>
                <option value="NOAA21">NOAA-21 (VIIRS)</option>
                <option value="AQUA">Aqua (MODIS)</option>
                <option value="TERRA">Terra (MODIS)</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleDownloadAndLoad}
            disabled={isLoading}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {downloadAndLoad.isPending ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                กำลังดาวน์โหลดและโหลด...
              </>
            ) : (
              'ดาวน์โหลดและโหลดข้อมูล'
            )}
          </button>
        </div>
      )}

      {/* CSV Upload - Sync */}
      {method === 'csv' && (
        <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <h4 className="font-medium text-gray-900 dark:text-white">โหลดจาก CSV (Synchronous)</h4>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="วางข้อมูล CSV ที่นี่..."
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadCsv}
              disabled={isLoading || !csvText.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loadCsv.isPending ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  กำลังโหลด...
                </>
              ) : (
                'โหลดข้อมูล CSV'
              )}
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              เหมาะสำหรับข้อมูลน้อยกว่า 10,000 แถว
            </span>
          </div>
        </div>
      )}

      {/* CSV Upload - Async */}
      {method === 'async' && (
        <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <h4 className="font-medium text-gray-900 dark:text-white">โหลดจาก CSV (Asynchronous)</h4>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="วางข้อมูล CSV ที่นี่..."
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Batch Size</label>
              <input
                type="number"
                min="1000"
                max="100000"
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value, 10))}
                className="w-32 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
              />
            </div>
            <button
              onClick={handleLoadCsvAsync}
              disabled={isLoading || !csvText.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loadCsvAsync.isPending ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  กำลังโหลด...
                </>
              ) : (
                'โหลดข้อมูล CSV แบบ Async'
              )}
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              เหมาะสำหรับข้อมูลมากกว่า 10,000 แถว
            </span>
          </div>
        </div>
      )}

      {/* Clear Data Button */}
      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleClear}
          disabled={isLoading || !lastResult}
          className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {clearHotspots.isPending ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              กำลังล้าง...
            </>
          ) : (
            'ล้างข้อมูลทั้งหมด'
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Last Result */}
      {lastResult && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 text-sm">
          <div className="font-medium">โหลดสำเร็จ!</div>
          <div>{lastResult.message}</div>
          <div className="text-xs mt-1">จำนวน: {lastResult.count?.toLocaleString() || lastResult.totalRows?.toLocaleString()} แถว</div>
        </div>
      )}
    </div>
  );
}