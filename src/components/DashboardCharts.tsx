'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DailyChartData {
  date: string;
  accountsAbove100k: number;
  accountsAbove1k: number;
  totalPlays: number;
}

interface DailyVideoCountData {
  date: string;
  videoCount: number;
}

interface ChartData {
  finishedAccounts: DailyChartData[];
  semiFinishedAccounts: DailyChartData[];
  finishedVideoCounts: DailyVideoCountData[];
  semiFinishedVideoCounts: DailyVideoCountData[];
}

interface DashboardChartsProps {
  className?: string;
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ className = '' }) => {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取图表数据
  const fetchChartData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/charts?days=7');
      const data = await response.json();

      if (data.success) {
        setChartData(data.data);
        setError(null);
      } else {
        throw new Error(data.error?.message || '获取图表数据失败');
      }
    } catch (error) {
      console.error('获取图表数据失败:', error);
      setError(error instanceof Error ? error.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData();
  }, []);

  // 格式化日期显示
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  // 格式化播放量显示
  const formatPlayCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="text-sm font-medium text-gray-900">{formatDate(label)}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey === 'accountsAbove100k' && '十万播账号: '}
              {entry.dataKey === 'accountsAbove1k' && '千播账号: '}
              {entry.dataKey === 'totalPlays' && '总播放量: '}
              {entry.dataKey === 'totalPlays' ? formatPlayCount(entry.value) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className={`bg-white shadow rounded-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-6 w-1/3"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-4">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-64 bg-gray-100 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white shadow rounded-lg p-6 ${className}`}>
        <div className="text-center text-red-600">
          <p className="text-lg font-semibold mb-2">⚠️ 图表数据加载失败</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchChartData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  if (!chartData) {
    return null;
  }

  return (
    <div className={`bg-white shadow rounded-lg p-6 ${className}`}>
      <h2 className="text-lg font-semibold text-gray-900 mb-6">
        📊 7日数据趋势图表
      </h2>

      {/* 成品账号图表区域 */}
      <div className="mb-12">
        <h3 className="text-md font-medium text-blue-700 mb-6 border-l-4 border-blue-500 pl-3">
          🔵 成品账号数据 (最近7天)
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 成品账号 - 十万播账号数 */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 mb-3">每日十万播账号数</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData.finishedAccounts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  dataKey="accountsAbove100k" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7, fill: '#1D4ED8' }}
                  label={{ fontSize: 10, fill: '#1D4ED8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 成品账号 - 千播账号数 */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 mb-3">每日千播账号数</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData.finishedAccounts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  dataKey="accountsAbove1k" 
                  stroke="#1D4ED8" 
                  strokeWidth={3}
                  dot={{ fill: '#1D4ED8', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7, fill: '#1E40AF' }}
                  label={{ fontSize: 10, fill: '#1E40AF' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 成品账号 - 总播放量 */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 mb-3">每日总播放量</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData.finishedAccounts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  fontSize={12}
                />
                <YAxis 
                  tickFormatter={formatPlayCount}
                  fontSize={12}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  dataKey="totalPlays" 
                  stroke="#1E40AF" 
                  strokeWidth={3}
                  dot={{ fill: '#1E40AF', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7, fill: '#1E3A8A' }}
                  label={{ fontSize: 10, fill: '#1E3A8A', formatter: formatPlayCount }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 半成品账号图表区域 */}
      <div>
        <h3 className="text-md font-medium text-orange-700 mb-6 border-l-4 border-orange-500 pl-3">
          🟠 半成品账号数据 (最近7天)
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 半成品账号 - 十万播账号数 */}
          <div className="bg-orange-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-orange-800 mb-3">每日十万播账号数</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData.semiFinishedAccounts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  dataKey="accountsAbove100k" 
                  stroke="#F97316" 
                  strokeWidth={3}
                  dot={{ fill: '#F97316', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7, fill: '#EA580C' }}
                  label={{ fontSize: 10, fill: '#EA580C' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 半成品账号 - 千播账号数 */}
          <div className="bg-orange-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-orange-800 mb-3">每日千播账号数</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData.semiFinishedAccounts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  dataKey="accountsAbove1k" 
                  stroke="#EA580C" 
                  strokeWidth={3}
                  dot={{ fill: '#EA580C', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7, fill: '#C2410C' }}
                  label={{ fontSize: 10, fill: '#C2410C' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 半成品账号 - 总播放量 */}
          <div className="bg-orange-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-orange-800 mb-3">每日总播放量</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData.semiFinishedAccounts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  fontSize={12}
                />
                <YAxis 
                  tickFormatter={formatPlayCount}
                  fontSize={12}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  dataKey="totalPlays" 
                  stroke="#C2410C" 
                  strokeWidth={3}
                  dot={{ fill: '#C2410C', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7, fill: '#B91C1C' }}
                  label={{ fontSize: 10, fill: '#B91C1C', formatter: formatPlayCount }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 视频发布数量图表区域 */}
      <div className="mt-12">
        <h3 className="text-md font-medium text-green-700 mb-6 border-l-4 border-green-500 pl-3">
          🎬 每日视频发布数量 (最近7天)
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 成品账号每日视频数量 */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 mb-3">成品账号每日发布视频数</h4>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData.finishedVideoCounts}>
                <defs>
                  <linearGradient id="colorFinishedVideos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip 
                  formatter={(value) => [value, '视频数量']}
                  labelFormatter={formatDate}
                />
                <Area 
                  dataKey="videoCount" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorFinishedVideos)"
                  label={{ fontSize: 12, fill: '#1D4ED8' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 半成品账号每日视频数量 */}
          <div className="bg-orange-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-orange-800 mb-3">半成品账号每日发布视频数</h4>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData.semiFinishedVideoCounts}>
                <defs>
                  <linearGradient id="colorSemiFinishedVideos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#F97316" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip 
                  formatter={(value) => [value, '视频数量']}
                  labelFormatter={formatDate}
                />
                <Area 
                  dataKey="videoCount" 
                  stroke="#F97316" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorSemiFinishedVideos)"
                  label={{ fontSize: 12, fill: '#EA580C' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 数据说明 */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600">
          💡 <strong>图表说明:</strong> 
          基于作品发布时间(publish_time)统计每日数据。「十万播账号」指当天发布作品总播放量≥10万的账号数；
          「千播账号」指当天发布作品总播放量≥1000的账号数；「总播放量」为当天发布的所有作品播放量之和。
        </p>
      </div>
    </div>
  );
};