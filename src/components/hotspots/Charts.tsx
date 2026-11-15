import {
  Line,
  BarChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import type { TimeSeriesPoint } from '../../lib/hotspots/types';

// ==================== Color Palette ====================

const CHART_COLORS = {
  hotspots: '#ef4444',
  frp: '#f97316',
  avgFrp: '#eab308',
  maxFrp: '#dc2626',
  confidence: {
    high: '#ef4444',
    nominal: '#f97316',
    low: '#eab308',
  },
};

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
};

const AXIS_STYLE = {
  stroke: '#9ca3af',
  fontSize: 11,
};

const GRID_STYLE = {
  strokeDasharray: '3 3',
  stroke: '#e5e7eb',
};

// ==================== Time Series Chart ====================

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
  height?: number;
  showHotspots?: boolean;
  showFRP?: boolean;
  showAvgFRP?: boolean;
  showMaxFRP?: boolean;
  className?: string;
}

export function TimeSeriesChart({
  data,
  height = 300,
  showHotspots = true,
  showFRP = true,
  showAvgFRP = false,
  showMaxFRP = false,
  className = '',
}: TimeSeriesChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center h-[${height}px] bg-gray-50 dark:bg-gray-800 rounded-lg ${className}`}>
        <p className="text-gray-500 dark:text-gray-400">No time series data available</p>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid {...GRID_STYLE} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => {
              const date = new Date(value);
              return date.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
            }}
            {...AXIS_STYLE}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="left"
            orientation="left"
            tickFormatter={(value: number | string) => {
              const num = typeof value === 'number' ? value : parseFloat(value);
              return num >= 1000 ? `${(num/1000).toFixed(1)}k` : String(num);
            }}
            {...AXIS_STYLE}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(value: number | string) => {
              const num = typeof value === 'number' ? value : parseFloat(value);
              return num.toFixed(1);
            }}
            {...AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ paddingTop: 10 }} />

          {showHotspots && (
            <Bar
              yAxisId="left"
              dataKey="count"
              name="Hotspots"
              fill={CHART_COLORS.hotspots}
              radius={[4, 4, 0, 0]}
            />
          )}

          {showFRP && (
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="totalFrp"
              name="Total FRP"
              stroke={CHART_COLORS.frp}
              fill={CHART_COLORS.frp}
              fillOpacity={0.1}
              strokeWidth={2}
            />
          )}

          {showAvgFRP && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgFrp"
              name="Avg FRP"
              stroke={CHART_COLORS.avgFrp}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
          )}

          {showMaxFRP && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="maxFrp"
              name="Max FRP"
              stroke={CHART_COLORS.maxFrp}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ==================== Confidence Breakdown Chart ====================

interface ConfidenceBreakdownProps {
  data: { low: number; nominal: number; high: number };
  height?: number;
  className?: string;
  showLabels?: boolean;
}

export function ConfidenceBreakdownChart({
  data,
  height = 200,
  className = '',
  showLabels = true,
}: ConfidenceBreakdownProps) {
  const total = data.low + data.nominal + data.high;
  const chartData = [
    { name: 'High', value: data.high, color: CHART_COLORS.confidence.high, percentage: total > 0 ? ((data.high / total) * 100).toFixed(1) : '0' },
    { name: 'Nominal', value: data.nominal, color: CHART_COLORS.confidence.nominal, percentage: total > 0 ? ((data.nominal / total) * 100).toFixed(1) : '0' },
    { name: 'Low', value: data.low, color: CHART_COLORS.confidence.low, percentage: total > 0 ? ((data.low / total) * 100).toFixed(1) : '0' },
  ];

  return (
    <div className={`w-full ${className}`}>
      <div className="flex flex-col items-center" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid {...GRID_STYLE} horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} tick={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={60}
              tickLine={false}
              axisLine={false}
              tick={{ ...AXIS_STYLE, fill: '#374151' }}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar
              dataKey="value"
              name="Count"
              radius={[0, 4, 4, 0]}
            >
              {chartData.map((entry, index) => (
                <Bar key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {showLabels && (
          <div className="flex justify-center gap-6 mt-4 flex-wrap">
            {chartData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: entry.color }} />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {entry.name}: {entry.value} ({entry.percentage}%)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Satellite Breakdown Chart ====================

interface SatelliteBreakdownProps {
  data: Record<string, number>;
  height?: number;
  className?: string;
}

export function SatelliteBreakdownChart({
  data,
  height = 200,
  className = '',
}: SatelliteBreakdownProps) {
  const entries = Object.entries(data).map(([name, value]) => ({ name, value }));

  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={entries}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid {...GRID_STYLE} horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} tick={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={80}
            tickLine={false}
            axisLine={false}
            tick={{ ...AXIS_STYLE, fill: '#374151' }}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar
            dataKey="value"
            fill="#6366f1"
            radius={[0, 4, 4, 0]}
          >
            {entries.map((_, index) => (
              <Bar key={index} fill={`hsl(${240 + index * 30}, 70%, 55%)`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ==================== Day/Night Chart ====================

interface DayNightChartProps {
  day: number;
  night: number;
  height?: number;
  className?: string;
}

export function DayNightChart({
  day,
  night,
  height = 150,
  className = '',
}: DayNightChartProps) {
  const total = day + night;
  const data = [
    { name: 'Day', value: day, color: '#f59e0b' },
    { name: 'Night', value: night, color: '#6366f1' },
  ];

  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="horizontal"
          margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
        >
          <CartesianGrid {...GRID_STYLE} vertical={false} />
          <XAxis type="number" tickLine={false} axisLine={false} tick={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={50}
            tickLine={false}
            axisLine={false}
            tick={{ ...AXIS_STYLE, fill: '#374151' }}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar
            dataKey="value"
            radius={[4, 0, 0, 4]}
          >
            {data.map((entry, index) => (
              <Bar key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-6 mt-3">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-600 dark:text-gray-300">
              {entry.name}: {entry.value} ({total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0'}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== Stats Cards ====================

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: { value: number; label: string };
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, unit, trend, icon, className = '' }: StatCardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
          <div className="flex items-baseline gap-1">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            {unit && <p className="text-sm text-gray-500 dark:text-gray-400">{unit}</p>}
          </div>
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span className={`text-sm font-medium ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%
              </span>
              <span className="text-xs text-gray-500">{trend.label}</span>
            </div>
          )}
        </div>
        {icon && <div className="text-gray-300 dark:text-gray-600">{icon}</div>}
      </div>
    </div>
  );
}

interface StatsGridProps {
  stats: {
    totalCount: number;
    dateRange: { from: string; to: string } | null;
    confidenceBreakdown: { low: number; nominal: number; high: number };
    satelliteBreakdown: Record<string, number>;
    daynightBreakdown: { D: number; N: number };
    frpStats: { min: number; max: number; avg: number; sum: number };
    bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null;
  };
  className?: string;
}

export function StatsGrid({ stats, className = '' }: StatsGridProps) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      <StatCard
        label="Total Hotspots"
        value={stats.totalCount.toLocaleString()}
        icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
      />
      <StatCard
        label="Avg FRP"
        value={stats.frpStats.avg.toFixed(1)}
        unit="MW"
        icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>}
      />
      <StatCard
        label="Max FRP"
        value={stats.frpStats.max.toFixed(1)}
        unit="MW"
        icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
      />
      <StatCard
        label="Date Range"
        value={stats.dateRange ? `${stats.dateRange.from} → ${stats.dateRange.to}` : 'N/A'}
        icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
      />
    </div>
  );
}