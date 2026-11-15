import { useState, useMemo } from 'react';
import type { HotspotRow } from '../../lib/hotspots/types';

interface DataTableProps {
  data: HotspotRow[];
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: HotspotRow) => void;
  className?: string;
}

const DEFAULT_PAGE_SIZE = 50;

export function DataTable({
  data,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageChange,
  onRowClick,
  className = '',
}: DataTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof HotspotRow; direction: 'asc' | 'desc' } | null>(null);

  const totalPages = Math.ceil(data.length / pageSize);

  // Clamp current page
  if (currentPage > totalPages) setCurrentPage(totalPages);

  const paginatedData = useMemo(() => {
    let result = [...data];

    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const start = (currentPage - 1) * pageSize;
    return result.slice(start, start + pageSize);
  }, [data, sortConfig, currentPage, pageSize]);

  const handleSort = (key: keyof HotspotRow) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const handlePageChange = (page: number) => {
    const clampedPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(clampedPage);
    onPageChange?.(clampedPage);
  };

  const confidenceColors: Record<string, string> = {
    high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    nominal: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    low: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-300',
  };

  const dayNightColors: Record<string, string> = {
    D: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    N: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  };

  const columns: Array<{ key: keyof HotspotRow; label: string; sortable: boolean; render?: (row: HotspotRow) => React.ReactNode }> = [
    { key: 'date', label: 'Date', sortable: true },
    { key: 'time', label: 'Time', sortable: true },
    { key: 'confidence', label: 'Confidence', sortable: true, render: (row) => (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${confidenceColors[row.confidence]}`}>
        {row.confidence.charAt(0).toUpperCase() + row.confidence.slice(1)}
      </span>
    )},
    { key: 'frp', label: 'FRP (MW)', sortable: true, render: (row) => row.frp.toFixed(1) },
    { key: 'brightness', label: 'Brightness (K)', sortable: true, render: (row) => row.brightness.toFixed(1) },
    { key: 'satellite', label: 'Satellite', sortable: true },
    { key: 'instrument', label: 'Instrument', sortable: true },
    { key: 'daynight', label: 'Day/Night', sortable: true, render: (row) => (
      <span className={`px-2 py-0.5 rounded text-xs ${dayNightColors[row.daynight]}`}>
        {row.daynight === 'D' ? 'Day' : 'Night'}
      </span>
    )},
    { key: 'lat', label: 'Lat', sortable: true, render: (row) => row.lat.toFixed(4) },
    { key: 'lon', label: 'Lon', sortable: true, render: (row) => row.lon.toFixed(4) },
  ];

  if (data.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <p className="text-gray-500 dark:text-gray-400">No hotspot data to display</p>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer select-none ${col.sortable ? 'hover:bg-gray-100 dark:hover:bg-gray-700' : ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortConfig?.key === col.key && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {paginatedData.map((row, index) => (
              <tr
                key={index}
                className={`${onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : ''} ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800'}`}
                onClick={() => onRowClick?.(row)}
              >
                <td className="px-4 py-2 text-gray-900 dark:text-white">{row.date}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{row.time}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${confidenceColors[row.confidence]}`}>
                    {row.confidence.charAt(0).toUpperCase() + row.confidence.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-900 dark:text-white font-mono">{row.frp.toFixed(1)}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-300 font-mono">{row.brightness.toFixed(1)}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{row.satellite}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{row.instrument}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${dayNightColors[row.daynight]}`}>
                    {row.daynight === 'D' ? 'Day' : 'Night'}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-300 font-mono">{row.lat.toFixed(4)}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-300 font-mono">{row.lon.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, data.length)} of {data.length.toLocaleString()} records
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Need to fix the col reference in the render
// Let me fix this by using a proper column render approach