import { useMemo } from 'react';
import type { HotspotRow, PaginationInfo, Satellite, Instrument } from '../../lib/hotspots';

interface DataTableProps {
  data: HotspotRow[];
  pagination: PaginationInfo | null;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  loading?: boolean;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  low: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  nominal: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  high: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const SATELLITE_COLORS: Record<string, string> = {
  SNPP: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  NOAA20: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  NOAA21: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  AQUA: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  TERRA: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
};

const INSTRUMENT_COLORS: Record<string, string> = {
  VIIRS: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  MODIS: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const DAYNIGHT_COLORS: Record<string, string> = {
  D: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  N: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

function ConfidenceBadge({ level }: { level: string }) {
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
        CONFIDENCE_COLORS[level] || 'bg-gray-100 text-gray-800'
      }`}
    >
      {level === 'low' ? 'ต่ำ' : level === 'nominal' ? 'ปานกลาง' : 'สูง'}
    </span>
  );
}

function SatelliteBadge({ satellite }: { satellite: Satellite }) {
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
        SATELLITE_COLORS[satellite] || 'bg-gray-100 text-gray-800'
      }`}
    >
      {satellite}
    </span>
  );
}

function InstrumentBadge({ instrument }: { instrument: Instrument }) {
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
        INSTRUMENT_COLORS[instrument] || 'bg-gray-100 text-gray-800'
      }`}
    >
      {instrument}
    </span>
  );
}

function DayNightBadge({ dn }: { dn: string }) {
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
        DAYNIGHT_COLORS[dn] || 'bg-gray-100 text-gray-800'
      }`}
    >
      {dn === 'D' ? 'กลางวัน' : 'กลางคืน'}
    </span>
  );
}

function FrpCell({ frp }: { frp: number }) {
  const color = frp >= 100 ? 'text-red-600' : frp >= 50 ? 'text-orange-600' : frp >= 10 ? 'text-yellow-600' : 'text-green-600';
  return (
    <span className={`font-mono font-medium ${color} dark:text-gray-300`}>
      {frp.toFixed(1)}
    </span>
  );
}

export function DataTable({ data, pagination, onPageChange, onPageSizeChange, loading }: DataTableProps) {
  const columns = useMemo(() => [
    { key: 'date', header: 'วันที่', width: '120px' },
    { key: 'time', header: 'เวลา', width: '80px' },
    { key: 'lat', header: 'Latitude', width: '100px' },
    { key: 'lon', header: 'Longitude', width: '100px' },
    { key: 'confidence', header: 'ความเชื่อมั่น', width: '100px' },
    { key: 'frp', header: 'FRP (MW)', width: '90px' },
    { key: 'satellite', header: 'ดาวเทียม', width: '100px' },
    { key: 'instrument', header: 'เครื่องมือ', width: '100px' },
    { key: 'daynight', header: 'วัน/คืน', width: '80px' },
    { key: 'brightness', header: 'ความสว่าง (K)', width: '110px' },
  ], []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">ตารางข้อมูล Hotspots</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700">
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">ตารางข้อมูล Hotspots</h3>
        </div>
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          ไม่พบข้อมูล
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">ตารางข้อมูล Hotspots</h3>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          แสดง {data.length} จาก {pagination?.totalItems || data.length} รายการ
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white font-mono">
                  {row.date}
                </td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white font-mono">
                  {row.time}
                </td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white font-mono">
                  {row.lat.toFixed(6)}
                </td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white font-mono">
                  {row.lon.toFixed(6)}
                </td>
                <td className="px-4 py-2">
                  <ConfidenceBadge level={row.confidence} />
                </td>
                <td className="px-4 py-2">
                  <FrpCell frp={row.frp} />
                </td>
                <td className="px-4 py-2">
                  <SatelliteBadge satellite={row.satellite} />
                </td>
                <td className="px-4 py-2">
                  <InstrumentBadge instrument={row.instrument} />
                </td>
                <td className="px-4 py-2">
                  <DayNightBadge dn={row.daynight} />
                </td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white font-mono">
                  {row.brightness.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            หน้า {pagination.page} จาก {pagination.totalPages} • ทั้งหมด {pagination.totalItems.toLocaleString()} รายการ
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pagination.pageSize}
              onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm
                focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            >
              {[25, 50, 100, 200, 500].map((size) => (
                <option key={size} value={size}>
                  {size} ต่อหน้า
                </option>
              ))}
            </select>
            <button
              onClick={() => onPageChange(1)}
              disabled={pagination.page === 1}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded
                bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300
                disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 text-sm"
            >
              ««
            </button>
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded
                bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300
                disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 text-sm"
            >
              «
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300">
              {pagination.page}
            </span>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded
                bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300
                disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 text-sm"
            >
              »
            </button>
            <button
              onClick={() => onPageChange(pagination.totalPages)}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded
                bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300
                disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 text-sm"
            >
              »»
            </button>
          </div>
        </div>
      )}
    </div>
  );
}