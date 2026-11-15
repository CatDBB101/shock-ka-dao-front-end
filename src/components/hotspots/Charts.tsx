import {
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import type { TimeSeriesPoint, HotspotStats, ConfidenceLevel, DayNight } from '../../lib/hotspots';

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
  height?: number;
}

export function TimeSeriesChart({ data, height = 300 }: TimeSeriesChartProps) {
  if (!data.length) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">
        ไม่มีข้อมูล Time Series
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
  };

  const formatTooltipDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const tooltipFormatter = (value: unknown, name: unknown) => {
    const numValue = value as number | undefined;
    const key = name as string | undefined ?? '';
    if (numValue === undefined) return [0, key];
    if (key === 'count') return [numValue.toLocaleString(), 'จุดไฟ'];
    if (key === 'totalFrp') return [numValue.toFixed(1), 'MW'];
    if (key === 'avgFrp') return [numValue.toFixed(1), 'MW (เฉลี่ย)'];
    if (key === 'maxFrp') return [numValue.toFixed(1), 'MW (สูงสุด)'];
    return [numValue, key];
  };

  const legendFormatter = (value: string) => {
    if (value === 'count') return 'จำนวนจุดไฟ';
    if (value === 'totalFrp') return 'FRP รวม';
    if (value === 'avgFrp') return 'FRP เฉลี่ย';
    if (value === 'maxFrp') return 'FRP สูงสุด';
    return value;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">แนวโน้มจุดไฟตามเวลา</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          จำนวนจุดไฟและ FRP รวมรายวัน
        </p>
      </div>
      <div className="p-4" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorFrp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
              label={{ value: 'จำนวนจุดไฟ', angle: -90, position: 'insideLeft', offset: 20, fill: '#6b7280', fontSize: 11 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
              label={{ value: 'FRP รวม (MW)', angle: 90, position: 'insideRight', offset: -20, fill: '#6b7280', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              labelFormatter={(label: React.ReactNode) => formatTooltipDate(String(label))}
              formatter={tooltipFormatter}
            />
            <Legend
              wrapperStyle={{ paddingTop: '10px' }}
              formatter={legendFormatter}
            />
            <Area
              type="monotone"
              dataKey="count"
              yAxisId="left"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCount)"
            />
            <Area
              type="monotone"
              dataKey="totalFrp"
              yAxisId="right"
              stroke="#ef4444"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorFrp)"
            />
            <Line
              type="monotone"
              dataKey="avgFrp"
              yAxisId="right"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="maxFrp"
              yAxisId="right"
              stroke="#8b5cf6"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface BreakdownChartProps {
  stats: HotspotStats;
  height?: number;
}

export function BreakdownChart({ stats, height = 300 }: BreakdownChartProps) {
  if (!stats) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">
        ไม่มีข้อมูลสถิติ
      </div>
    );
  }

  // Transform confidenceBreakdown
  const confidenceData = (['low', 'nominal', 'high'] as ConfidenceLevel[]).map((name) => ({
    name: name === 'low' ? 'ต่ำ' : name === 'nominal' ? 'ปานกลาง' : 'สูง',
    value: stats.confidenceBreakdown[name] || 0,
    color: name === 'low' ? '#ef4444' : name === 'nominal' ? '#f59e0b' : '#22c55e',
  }));

  // Transform satelliteBreakdown
  const satelliteData = Object.entries(stats.satelliteBreakdown).map(([name, value]) => ({
    name,
    value,
  }));

  // Transform daynightBreakdown
  const daynightData = (['D', 'N'] as DayNight[]).map((name) => ({
    name: name === 'D' ? 'กลางวัน' : 'กลางคืน',
    value: stats.daynightBreakdown[name] || 0,
    color: name === 'D' ? '#f59e0b' : '#6b7280',
  }));

  const pieLabelFormatter = (name: string, percent: number | undefined) => {
    const p = percent ?? 0;
    return `${name} ${(p * 100).toFixed(1)}%`;
  };

  const tooltipNumberFormatter = (value: unknown) => [(value as number | undefined)?.toLocaleString() || '0', 'จุดไฟ'];
  const tooltipFrpFormatter = (value: unknown) => [(value as number | undefined)?.toFixed(1) || '0', 'MW'];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">การกระจายข้อมูล</h3>
      </div>
      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ height }}>
        {/* Confidence Pie */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
            ตามระดับความเชื่อมั่น
          </h4>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={confidenceData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }: { name?: string; percent?: number }) => pieLabelFormatter(String(name ?? ''), percent ?? 0)}
                labelLine={false}
              >
                {confidenceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
                formatter={tooltipNumberFormatter}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconType="circle"
                iconSize={10}
                wrapperStyle={{ paddingTop: '20px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Day/Night Pie */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
            ตามกลางวัน/กลางคืน
          </h4>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={daynightData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }: { name?: string; percent?: number }) => pieLabelFormatter(String(name ?? ''), percent ?? 0)}
                labelLine={false}
              >
                {daynightData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
                formatter={tooltipNumberFormatter}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconType="circle"
                iconSize={10}
                wrapperStyle={{ paddingTop: '20px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Satellite Bar */}
        <div className="lg:col-span-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
            ตามดาวเทียม
          </h4>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={satelliteData} layout="vertical" margin={{ top: 10, right: 10, left: 100, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
                formatter={tooltipNumberFormatter}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* FRP Stats */}
        <div className="lg:col-span-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
            สถิติ FRP
          </h4>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                { metric: 'Min', value: stats.frpStats.min },
                { metric: 'Max', value: stats.frpStats.max },
                { metric: 'Avg', value: stats.frpStats.avg },
                { metric: 'Sum', value: stats.frpStats.sum },
              ]}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="metric"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={false}
              />
              <YAxis
                type="number"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
                formatter={tooltipFrpFormatter}
              />
              <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

interface StatsSummaryProps {
  stats: HotspotStats | null;
}

export function StatsSummary({ stats }: StatsSummaryProps) {
  if (!stats) return null;

  const cards = [
    { label: 'จำนวนจุดไฟทั้งหมด', value: stats.totalCount.toLocaleString(), color: 'bg-blue-500', icon: '🔥' },
    { label: 'FRP รวม', value: `${stats.frpStats.sum.toFixed(1)} MW`, color: 'bg-red-500', icon: '📊' },
    { label: 'FRP เฉลี่ย', value: `${stats.frpStats.avg.toFixed(1)} MW`, color: 'bg-yellow-500', icon: '📈' },
    { label: 'FRP สูงสุด', value: `${stats.frpStats.max.toFixed(1)} MW`, color: 'bg-purple-500', icon: '🔝' },
    { label: 'FRP ต่ำสุด', value: `${stats.frpStats.min.toFixed(1)} MW`, color: 'bg-orange-500', icon: '📉' },
    { label: 'ช่วงวันที่', value: stats.dateRange ? `${stats.dateRange.from} ถึง ${stats.dateRange.to}` : 'N/A', color: 'bg-green-500', icon: '📅' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {cards.map((card, index) => (
        <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center text-white text-xl`}>
              {card.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{card.label}</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white truncate">{card.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}