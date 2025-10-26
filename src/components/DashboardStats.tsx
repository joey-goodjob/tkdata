"use client";

import React, { useState, useEffect } from "react";

interface DashboardStatsData {
  totalAccounts: number;
  finishedAccounts: number;
  finishedThousandVideos: number; // 成品号千播放视频数
  semiFinishedThousandVideos: number; // 半成品号千播放视频数
  allThousandVideos: number; // 所有账号千播放视频数（不区分成品/半成品）
}

interface DashboardStatsProps {
  className?: string;
  onLoadComplete?: () => void; // 🔄 新增：加载完成回调
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  className = "",
  onLoadComplete,
}) => {
  const [stats, setStats] = useState<DashboardStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0] // 默认今天
  );

  // 获取统计数据
  const fetchStats = async (date?: string) => {
    try {
      setLoading(true);
      const url = date
        ? `/api/dashboard/stats?date=${date}`
        : `/api/dashboard/stats`;

      console.log("📊 [DashboardStats] 开始加载统计数据...");
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
        setError(null);
        console.log("✅ [DashboardStats] 统计数据加载完成");
        // 🔄 通知父组件加载完成
        if (onLoadComplete) {
          onLoadComplete();
        }
      } else {
        throw new Error(data.error?.message || "获取统计数据失败");
      }
    } catch (error) {
      console.error("❌ [DashboardStats] 获取dashboard统计失败:", error);
      setError(error instanceof Error ? error.message : "未知错误");
    } finally {
      setLoading(false);
    }
  };

  // 初始加载和日期变化时重新获取数据
  useEffect(() => {
    fetchStats(selectedDate);
  }, [selectedDate]);

  // 处理日期变化
  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(event.target.value);
  };

  if (loading) {
    return (
      <div className={`bg-white shadow rounded-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="text-center p-4 bg-gray-50 rounded-lg"
              >
                <div className="h-8 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
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
          <p className="text-lg font-semibold mb-2">⚠️ 数据加载失败</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={() => fetchStats(selectedDate)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white shadow rounded-lg p-6 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-0">
          📊 账号统计总览
        </h2>
        <div className="flex items-center space-x-4">
          <label
            htmlFor="date-selector"
            className="text-sm font-medium text-gray-700"
          >
            选择日期:
          </label>
          <input
            id="date-selector"
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* 1. 总账号数 */}
        <div className="text-center p-6 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-3xl font-bold text-blue-600 mb-2">
            {stats?.totalAccounts.toLocaleString() || 0}
          </div>
          <div className="text-sm text-blue-700 font-medium">总账号数</div>
          <div className="text-xs text-blue-600 mt-1">(活跃账号)</div>
        </div>

        {/* 2. 成品账号数 */}
        <div className="text-center p-6 bg-green-50 rounded-lg border border-green-200">
          <div className="text-3xl font-bold text-green-600 mb-2">
            {stats?.finishedAccounts.toLocaleString() || 0}
          </div>
          <div className="text-sm text-green-700 font-medium">成品账号数</div>
          <div className="text-xs text-green-600 mt-1">(已标记完成)</div>
        </div>

        {/* 3. 成品号千播放视频数 */}
        <div className="text-center p-6 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="text-3xl font-bold text-yellow-600 mb-2">
            {stats?.finishedThousandVideos.toLocaleString() || 0}
          </div>
          <div className="text-sm text-yellow-700 font-medium">
            成品千播放视频
          </div>
          <div className="text-xs text-yellow-600 mt-1">
            ({selectedDate} 发布的千播放视频)
          </div>
        </div>

        {/* 4. 半成品号千播放视频数 */}
        <div className="text-center p-6 bg-purple-50 rounded-lg border border-purple-200">
          <div className="text-3xl font-bold text-purple-600 mb-2">
            {stats?.semiFinishedThousandVideos.toLocaleString() || 0}
          </div>
          <div className="text-sm text-purple-700 font-medium">
            半成品千播放视频
          </div>
          <div className="text-xs text-purple-600 mt-1">
            ({selectedDate} 发布的千播放视频)
          </div>
        </div>

        {/* 5. 所有账号千播放视频数 */}
        <div className="text-center p-6 bg-orange-50 rounded-lg border border-orange-200">
          <div className="text-3xl font-bold text-orange-600 mb-2">
            {stats?.allThousandVideos.toLocaleString() || 0}
          </div>
          <div className="text-sm text-orange-700 font-medium">
            所有千播放视频
          </div>
          <div className="text-xs text-orange-600 mt-1">
            ({selectedDate} 发布的千播放视频)
          </div>
        </div>
      </div>

      {/* 数据说明 */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600">
          💡 <strong>统计说明:</strong>
          前2项为账号总数统计，后3项为选定发布日期的千播放视频数统计。
          后3项统计基于最新上传数据，按作品发布时间筛选播放量≥1000的视频数量。
          第5项不区分成品号/半成品号，统计所有千播放视频。
          已删除的账号不计入统计。
        </p>
      </div>
    </div>
  );
};
