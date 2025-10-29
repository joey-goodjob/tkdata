"use client";

import React, { useEffect, useState } from "react";
import type { DashboardStats, TrendData, TopAccount, TopVideo } from "@/types";
import { PerformanceBarChart } from "./PerformanceBarChart";

interface StatsOverviewProps {
  className?: string;
  onLoadComplete?: () => void; // 🔄 新增：加载完成回调
  selectedDate?: string; // 🔄 新增：当前选择的日期
}

/**
 * 去重函数：以 work_url 为唯一标识去除重复视频
 * 保留每个视频的最新记录（按播放量排序，取最高播放量的记录）
 */
function removeDuplicateVideos(videos: TopVideo[]): TopVideo[] {
  if (!videos || videos.length === 0) {
    return [];
  }

  const videoMap = new Map<string, TopVideo>();

  videos.forEach((video) => {
    const key = video.work_url;

    // 如果已存在相同的 work_url，比较播放量，保留播放量更高的
    if (videoMap.has(key)) {
      const existingVideo = videoMap.get(key)!;
      if (video.play_count > existingVideo.play_count) {
        videoMap.set(key, video);
      }
    } else {
      videoMap.set(key, video);
    }
  });

  // 转换为数组并按播放量降序排序
  return Array.from(videoMap.values()).sort(
    (a, b) => b.play_count - a.play_count
  );
}

export function StatsOverview({
  className = "",
  onLoadComplete,
  selectedDate,
}: StatsOverviewProps) {
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(
    null
  );
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [topVideos, setTopVideos] = useState<TopVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // 获取统计数据 - 🔄 改为串行加载，减少数据库压力
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        console.log("📊 [StatsOverview] 开始加载概览数据...");

        // 🔄 串行加载：一个接一个地请求，避免同时占用多个数据库连接
        console.log("  → 加载dashboard数据...");
        const dashboardResponse = await fetch("/api/stats?type=dashboard");
        const dashboardData = await dashboardResponse.json();
        if (dashboardData.success) {
          setDashboardStats(dashboardData.data);
          console.log("  ✅ dashboard数据加载完成");
        }

        console.log("  → 加载趋势数据...");
        const trendsResponse = await fetch("/api/stats?type=trends&days=7");
        const trendsData = await trendsResponse.json();
        if (trendsData.success) {
          setTrendData(trendsData.data);
          console.log("  ✅ 趋势数据加载完成");
        }

        console.log("  → 加载排行数据...");
        // 使用传入的日期，如果没有则使用默认逻辑
        const dateParam = selectedDate ? `&date=${selectedDate}` : "";
        // 🔧 请求20条数据，用于前端去重
        const rankingsResponse = await fetch(
          `/api/stats?type=rankings&sortBy=totalPlays&limit=20${dateParam}`
        );
        const rankingsData = await rankingsResponse.json();
        if (rankingsData.success) {
          console.log("    📊 去重前数据条数:", rankingsData.data.length);
          // 🔄 前端去重：以 work_url 为唯一标识
          const uniqueVideos = removeDuplicateVideos(rankingsData.data);
          // 🔧 去重后只取前5条显示
          const top5Videos = uniqueVideos.slice(0, 5);
          console.log("    🔄 ���重后数据条数:", uniqueVideos.length);
          console.log("    🎯 最终显示条数:", top5Videos.length);
          console.log(
            "    📋 最终数据:",
            top5Videos.map((v) => ({ title: v.title, plays: v.play_count }))
          );
          setTopVideos(top5Videos);
          console.log("  ✅ 排行数据加载完成");
        }

        console.log("✅ [StatsOverview] 所有概览数据加载完成");
        // 🔄 通知父组件加载完成
        if (onLoadComplete) {
          onLoadComplete();
        }
      } catch (error) {
        console.error("❌ [StatsOverview] 获取统计数据失败:", error);
        setError("获取统计数据失败");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [onLoadComplete, selectedDate]);

  // 状态分布饼图组件
  const StatusPieChart = ({ data }: { data: DashboardStats }) => {
    const { statusDistribution, totalAccounts } = data;

    if (!statusDistribution || statusDistribution.length === 0) {
      return <div className="text-gray-500 text-center py-8">暂无数据</div>;
    }

    // 计算饼图数据
    let cumulativePercentage = 0;
    const chartData = statusDistribution.map((item, index) => {
      const percentage = (parseInt(item.count) / totalAccounts) * 100;
      const startAngle = cumulativePercentage * 3.6; // 转换为度数
      const endAngle = (cumulativePercentage + percentage) * 3.6;

      cumulativePercentage += percentage;

      const colors = ["#10B981", "#F59E0B", "#6B7280"]; // 绿色、黄色、灰色
      const color = colors[index % colors.length];

      return {
        ...item,
        percentage: percentage.toFixed(1),
        startAngle,
        endAngle,
        color,
        largeArcFlag: percentage > 50 ? 1 : 0,
      };
    });

    // 生成SVG路径
    const generatePath = (
      startAngle: number,
      endAngle: number,
      largeArcFlag: number
    ) => {
      const centerX = 100;
      const centerY = 100;
      const radius = 80;

      const startAngleRad = (startAngle - 90) * (Math.PI / 180);
      const endAngleRad = (endAngle - 90) * (Math.PI / 180);

      const x1 = centerX + radius * Math.cos(startAngleRad);
      const y1 = centerY + radius * Math.sin(startAngleRad);
      const x2 = centerX + radius * Math.cos(endAngleRad);
      const y2 = centerY + radius * Math.sin(endAngleRad);

      return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
    };

    return (
      <div className="flex items-center space-x-6">
        <div className="relative">
          <svg width="200" height="200" viewBox="0 0 200 200">
            {chartData.map((item, index) => (
              <path
                key={item.status}
                d={generatePath(
                  item.startAngle,
                  item.endAngle,
                  item.largeArcFlag
                )}
                fill={item.color}
                stroke="white"
                strokeWidth="2"
                className="hover:opacity-80 transition-opacity"
              />
            ))}
            <circle
              cx="100"
              cy="100"
              r="40"
              fill="white"
              stroke="#E5E7EB"
              strokeWidth="2"
            />
            <text
              x="100"
              y="95"
              textAnchor="middle"
              className="text-sm font-medium fill-gray-900"
            >
              总账号
            </text>
            <text
              x="100"
              y="110"
              textAnchor="middle"
              className="text-lg font-bold fill-gray-900"
            >
              {totalAccounts}
            </text>
          </svg>
        </div>

        <div className="space-y-3">
          {chartData.map((item) => (
            <div key={item.status} className="flex items-center space-x-3">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: item.color }}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">
                  {item.status || "未分类"}
                </div>
                <div className="text-xs text-gray-500">
                  {item.count} 个账号 ({item.percentage}%)
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 趋势线图组件
  const TrendLineChart = ({ data }: { data: TrendData[] }) => {
    if (!data || data.length === 0) {
      return <div className="text-gray-500 text-center py-8">暂无数据</div>;
    }

    const maxPlays = Math.max(...data.map((item) => item.totalPlays));
    const maxWorks = Math.max(...data.map((item) => item.worksCount));

    const chartWidth = 300;
    const chartHeight = 150;
    const padding = 20;

    // 生成路径点
    const generatePoints = (values: number[], max: number) => {
      return values.map((value, index) => {
        const x =
          padding + (index / (values.length - 1)) * (chartWidth - 2 * padding);
        const y =
          chartHeight - padding - (value / max) * (chartHeight - 2 * padding);
        return { x, y };
      });
    };

    const playsPoints = generatePoints(
      data.map((item) => item.totalPlays),
      maxPlays
    );
    const worksPoints = generatePoints(
      data.map((item) => item.worksCount),
      maxWorks
    );

    const generatePath = (points: { x: number; y: number }[]) => {
      if (points.length === 0) return "";

      let path = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        path += ` L ${points[i].x} ${points[i].y}`;
      }
      return path;
    };

    return (
      <div className="space-y-4">
        <svg width={chartWidth} height={chartHeight} className="border rounded">
          {/* 网格线 */}
          <defs>
            <pattern
              id="grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="#f3f4f6"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* 播放量趋势线 */}
          <path
            d={generatePath(playsPoints)}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* 作品数趋势线 */}
          <path
            d={generatePath(worksPoints)}
            fill="none"
            stroke="#10B981"
            strokeWidth="2"
            strokeDasharray="5,5"
          />

          {/* 数据点 */}
          {playsPoints.map((point, index) => (
            <circle
              key={`plays-${index}`}
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#3B82F6"
              className="hover:r-6 transition-all"
            />
          ))}
        </svg>

        {/* 图例 */}
        <div className="flex justify-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 bg-blue-500" />
            <span className="text-sm text-gray-600">播放量</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 bg-green-500 border-dashed border" />
            <span className="text-sm text-gray-600">作品数</span>
          </div>
        </div>

        {/* 时间轴 */}
        <div className="flex justify-between text-xs text-gray-500 px-5">
          {data.map((item) => (
            <span key={item.date}>
              {new Date(item.date).toLocaleDateString("zh-CN", {
                month: "short",
                day: "numeric",
              })}
            </span>
          ))}
        </div>
      </div>
    );
  };

  // 数字格式化函数
  const formatNumber = (num: number | undefined | null): string => {
    if (num == null || isNaN(num)) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-48 bg-gray-200 rounded"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="text-center text-red-600">
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <h2 className="text-xl font-bold text-gray-900 mb-6">数据统计概览</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 状态分布饼图 */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            账号状态分布
          </h3>
          {dashboardStats ? (
            <StatusPieChart data={dashboardStats} />
          ) : (
            <div className="text-gray-500 text-center py-8">数据加载中...</div>
          )}
        </div>

        {/* 表现对比柱状图 */}
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">热门视频排行</h3>
            <a
              href="/debug/videos"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              title="前往热门视频调试页面"
            >
              调试 →
            </a>
          </div>
          <PerformanceBarChart videos={topVideos} />
        </div>

        {/* 趋势线图 */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">7日趋势</h3>
          <TrendLineChart data={trendData} />
        </div>
      </div>

      {/* 统计卡片 */}
      {/* {dashboardStats && (
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {dashboardStats.totalAccounts}
            </div>
            <div className="text-sm text-blue-600">总账号数</div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {formatNumber(dashboardStats.totalWorks)}
            </div>
            <div className="text-sm text-green-600">总作品数</div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {formatNumber(dashboardStats.totalPlays)}
            </div>
            <div className="text-sm text-purple-600">总播放量</div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {formatNumber(dashboardStats.totalLikes)}
            </div>
            <div className="text-sm text-yellow-600">总点赞数</div>
          </div>
        </div>
      )} */}
    </div>
  );
}
