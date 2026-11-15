import { useState, useRef } from 'react';
import { useLoadHotspots, useLoadHotspotsAsync, useDownloadAndLoad, useClearHotspots } from '../../lib/hotspots/hooks';

interface DataLoaderProps {
  onDataLoaded?: () => void;
  className?: string;
}

export function DataLoader({ onDataLoaded, className = '' }: DataLoaderProps) {
  const [activeTab, setActiveTab] = useState<'paste' | 'file' | 'firecalendar'>('paste');
  const [csvText, setCsvText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [batchSize, setBatchSize] = useState(10000);
  const [fireCalendarParams, setFireCalendarParams] = useState({
    minLat: -35,
    maxLat: -32,
    minLon: -62,
    maxLon: -57,
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    source: 'VIIRS_SNPP_SP',
  });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCsv = useLoadHotspots();
  const loadCsvAsync = useLoadHotspotsAsync();
  const downloadAndLoad = useDownloadAndLoad();
  const clearData = useClearHotspots();

  const handlePasteLoad = async (asyncMode = false) => {
    if (!csvText.trim()) {
      setError('Please paste CSV data first');
      return;
    }
    setError(null);
    try {
      if (asyncMode) {
        await loadCsvAsync.mutateAsync({ csv: csvText, batchSize });
      } else {
        await loadCsv.mutateAsync(csvText);
      }
      setCsvText('');
      onDataLoaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CSV');
    }
  };

  const handleFileLoad = async (asyncMode = false) => {
    if (!file) {
      setError('Please select a CSV file first');
      return;
    }
    setError(null);
    try {
      const text = await file.text();
      if (asyncMode) {
        await loadCsvAsync.mutateAsync({ csv: text, batchSize });
      } else {
        await loadCsv.mutateAsync(text);
      }
      setFile(null);
      fileInputRef.current!.value = '';
      onDataLoaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CSV');
    }
  };

  const handleFireCalendarLoad = async () => {
    setError(null);
    try {
      await downloadAndLoad.mutateAsync(fireCalendarParams);
      onDataLoaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download from FireCalendar');
    }
  };

  const handleClear = async () => {
    if (!confirm('Are you sure you want to clear all loaded data?')) return;
    setError(null);
    try {
      await clearData.mutateAsync();
      onDataLoaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear data');
    }
  };

  const isLoading = loadCsv.isPending || loadCsvAsync.isPending || downloadAndLoad.isPending || clearData.isPending;

  const tabs = [
    { id: 'paste', label: 'Paste CSV', icon: '📋' },
    { id: 'file', label: 'Upload File', icon: '📁' },
    { id: 'firecalendar', label: 'FireCalendar API', icon: '☁️' },
  ];

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Load Data</h3>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading...
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as any); setError(null); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Paste CSV Tab */}
      {activeTab === 'paste' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Paste CSV data (include header row)
          </label>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={8}
            placeholder="latitude,longitude,brightness,frp,confidence,date,time,satellite,instrument,daynight
-33.1234,-59.5678,320.5,45.6,high,2024-01-15,14:30,SNPP,VIIRS,D
-33.2345,-59.6789,315.2,38.4,nominal,2024-01-15,15:45,AQUA,MODIS,D"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handlePasteLoad(false)}
              disabled={isLoading || !csvText.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              Load (Sync)
            </button>
            <button
              onClick={() => handlePasteLoad(true)}
              disabled={isLoading || !csvText.trim()}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              Load (Async)
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Expected columns: latitude, longitude, brightness, frp, confidence, date, time, satellite, instrument, daynight
          </p>
        </div>
      )}

      {/* File Upload Tab */}
      {activeTab === 'file' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Select CSV file
          </label>
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  setError(null);
                }
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              file ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-blue-500'
            }`}>
              {file ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
                      <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setFile(null); fileInputRef.current!.value = ''; }}
                    className="text-gray-400 hover:text-gray-600"
                  >×</button>
                </div>
              ) : (
                <div>
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-gray-600 dark:text-gray-400">Drag & drop CSV file here, or click to browse</p>
                  <p className="text-xs text-gray-500 mt-1">Max 50MB</p>
                </div>
              )}
            </div>
          </div>

          {file && (
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={batchSize > 1000}
                  onChange={(e) => setBatchSize(e.target.checked ? 10000 : 1000)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Async mode (batch size: {batchSize.toLocaleString()})
              </label>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => handleFileLoad(false)}
              disabled={isLoading || !file}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              Load (Sync)
            </button>
            <button
              onClick={() => handleFileLoad(true)}
              disabled={isLoading || !file}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              Load (Async)
            </button>
          </div>
        </div>
      )}

      {/* FireCalendar API Tab */}
      {activeTab === 'firecalendar' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Download from FireCalendar API
          </label>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Requires FireCalendar API server running (default: http://localhost:7860)
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Lat</label>
              <input
                type="number"
                step="0.0001"
                value={fireCalendarParams.minLat}
                onChange={(e) => setFireCalendarParams({ ...fireCalendarParams, minLat: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Lat</label>
              <input
                type="number"
                step="0.0001"
                value={fireCalendarParams.maxLat}
                onChange={(e) => setFireCalendarParams({ ...fireCalendarParams, maxLat: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Lon</label>
              <input
                type="number"
                step="0.0001"
                value={fireCalendarParams.minLon}
                onChange={(e) => setFireCalendarParams({ ...fireCalendarParams, minLon: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Lon</label>
              <input
                type="number"
                step="0.0001"
                value={fireCalendarParams.maxLon}
                onChange={(e) => setFireCalendarParams({ ...fireCalendarParams, maxLon: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
              <input
                type="date"
                value={fireCalendarParams.startDate}
                onChange={(e) => setFireCalendarParams({ ...fireCalendarParams, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
              <input
                type="date"
                value={fireCalendarParams.endDate}
                onChange={(e) => setFireCalendarParams({ ...fireCalendarParams, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source</label>
              <select
                value={fireCalendarParams.source}
                onChange={(e) => setFireCalendarParams({ ...fireCalendarParams, source: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="VIIRS_SNPP_SP">VIIRS SNPP SP</option>
                <option value="VIIRS_SNPP_NRT">VIIRS SNPP NRT</option>
                <option value="VIIRS_NOAA20_SP">VIIRS NOAA20 SP</option>
                <option value="VIIRS_NOAA20_NRT">VIIRS NOAA20 NRT</option>
                <option value="VIIRS_NOAA21_NRT">VIIRS NOAA21 NRT</option>
                <option value="MODIS_SP">MODIS SP</option>
                <option value="MODIS_NRT">MODIS NRT</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleFireCalendarLoad}
            disabled={isLoading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Download & Load
          </button>
        </div>
      )}

      {/* Clear Data Button */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleClear}
          disabled={isLoading}
          className="w-full px-4 py-2 text-red-600 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
        >
          Clear All Data
        </button>
      </div>
    </div>
  );
}