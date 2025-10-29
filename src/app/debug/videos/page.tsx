"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PerformanceBarChart } from "@/components/PerformanceBarChart";
import type { TopVideo } from "@/types";

interface DebugLog {
  timestamp: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
  data?: any;
}

export default function VideosDebugPage() {
  // 状态管理
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // 获取当前UTC日期（比北京时间晚8小时）
    const now = new Date();
    const utcDate = new Date(now.getTime() - 8 * 60 * 60 * 1000);
    return utcDate.toISOString().split("T")[0];
  });
  const [displayCount, setDisplayCount] = useState<number>(5);
  const [rawVideos, setRawVideos] = useState<TopVideo[]>([]);
  const [uniqueVideos, setUniqueVideos] = useState<TopVideo[]>([]);
  const [displayVideos, setDisplayVideos] = useState<TopVideo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [showRawData, setShowRawData] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  // 添加调试日志
  const addLog = useCallback(
    (type: DebugLog["type"], message: string, data?: any) => {
      const log: DebugLog = {
        timestamp: new Date().toLocaleTimeString("zh-CN"),
        type,
        message,
        data,
      };
      setDebugLogs((prev) => [log, ...prev.slice(0, 49)]); // 保留最新50条
    },
    []
  );

  // 去重函数（复用原有逻辑）
  const removeDuplicateVideos = useCallback(
    (videos: TopVideo[]): TopVideo[] => {
      if (!videos || videos.length === 0) {
        return [];
      }

      const videoMap = new Map<string, TopVideo>();

      videos.forEach((video) => {
        const key = video.work_url;

        if (videoMap.has(key)) {
          const existingVideo = videoMap.get(key)!;
          if (video.play_count > existingVideo.play_count) {
            videoMap.set(key, video);
          }
        } else {
          videoMap.set(key, video);
        }
      });

      return Array.from(videoMap.values()).sort(
        (a, b) => b.play_count - a.play_count
      );
    },
    []
  );

  // 获取数据
  const fetchVideos = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      addLog("info", "开始获取热门视频数据...");
      addLog("info", `选择的UTC日期: ${selectedDate}`);
      addLog(
        "info",
        `对应的北京时间: ${new Date(
          selectedDate + "T00:00:00+08:00"
        ).toLocaleDateString("zh-CN")}`
      );

      const dateParam = selectedDate ? `&date=${selectedDate}` : "";
      const response = await fetch(
        `/api/stats?type=rankings&sortBy=totalPlays&limit=20${dateParam}`
      );

      addLog(
        "info",
        `API请求: /api/stats?type=rankings&sortBy=totalPlays&limit=20${dateParam}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      addLog("success", `API响应成功`, {
        success: data.success,
        dataCount: data.data?.length,
      });

      if (data.success) {
        const raw = data.data || [];
        setRawVideos(raw);
        addLog("info", `原始数据加载完成，共 ${raw.length} 条`);

        // 去重处理
        const unique = removeDuplicateVideos(raw);
        setUniqueVideos(unique);
        addLog("info", `去重处理完成，去重后 ${unique.length} 条`);

        // 设置显示数据
        const display = unique.slice(0, displayCount);
        setDisplayVideos(display);
        addLog("info", `设置显示数据，显示前 ${display.length} 条`);
      } else {
        throw new Error(data.error?.message || "获取数据失败");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "未知错误";
      setError(errorMsg);
      addLog("error", `获取数据失败: ${errorMsg}`, error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, displayCount, removeDuplicateVideos, addLog]);

  // 初始化加载
  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      addLog("info", "自动刷新数据...");
      fetchVideos();
    }, 30000); // 30秒刷新一次

    return () => clearInterval(interval);
  }, [autoRefresh, fetchVideos, addLog]);

  // 显示数量变化时更新显示数据
  useEffect(() => {
    const display = uniqueVideos.slice(0, displayCount);
    setDisplayVideos(display);
    addLog("info", `显示数量调整为 ${displayCount} 条`);
  }, [displayCount, uniqueVideos, addLog]);

  // 数字格式化
  const formatNumber = (num: number | undefined | null): string => {
    if (num == null || isNaN(num)) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // 导出数据
  const exportData = () => {
    const csvContent = [
      ["标题", "作者", "视频链接", "播放量", "点赞数", "发布时间", "排名"],
      ...displayVideos.map((video, index) => [
        video.title,
        video.author,
        video.work_url,
        video.play_count,
        video.like_count,
        new Date(video.publish_time).toLocaleString("zh-CN"),
        index + 1,
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `videos_debug_${selectedDate}.csv`;
    link.click();

    addLog("success", "数据导出成功");
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 页面头部 */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                热门视频排行调试页面
              </h1>
              <p className="text-gray-600 mt-1">
                专门用于调试热门视频排行功能，无需加载主页其他数据
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => (window.location.href = "/dashboard")}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                返回主页
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：主要调试区域 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 控制面板 */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                调试控制
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 日期选择 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    选择日期debug{" "}
                    <span className="text-xs text-gray-500">(UTC时间)</span>
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 显示数量 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    显示数量: {displayCount}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={displayCount}
                    onChange={(e) => setDisplayCount(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                {/* 自动刷新 */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="autoRefresh"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="mr-2"
                  />
                  <label
                    htmlFor="autoRefresh"
                    className="text-sm text-gray-700"
                  >
                    自动刷新(30s)
                  </label>
                </div>
              </div>

              <div className="flex space-x-3 mt-4">
                <button
                  onClick={fetchVideos}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "加载中..." : "刷新数据"}
                </button>
                <button
                  onClick={() => setShowRawData(!showRawData)}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  {showRawData ? "隐藏" : "显示"}原始数据
                </button>
                <button
                  onClick={exportData}
                  disabled={displayVideos.length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  导出数据
                </button>
              </div>
            </div>

            {/* 热门视频排行图表 */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                热门视频排行 (显示 {displayVideos.length} 条)
              </h2>
              {loading ? (
                <div className="text-center py-8 text-gray-500">加载中...</div>
              ) : error ? (
                <div className="text-center py-8 text-red-600">
                  错误: {error}
                </div>
              ) : (
                <PerformanceBarChart videos={displayVideos} />
              )}
            </div>

            {/* 数据统计 */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                数据统计
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded">
                  <div className="text-lg font-bold text-blue-600">
                    {rawVideos.length}
                  </div>
                  <div className="text-sm text-blue-600">原始数据</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded">
                  <div className="text-lg font-bold text-green-600">
                    {uniqueVideos.length}
                  </div>
                  <div className="text-sm text-green-600">去重后</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded">
                  <div className="text-lg font-bold text-purple-600">
                    {displayVideos.length}
                  </div>
                  <div className="text-sm text-purple-600">当前显示</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded">
                  <div className="text-lg font-bold text-yellow-600">
                    {displayVideos.length > 0
                      ? formatNumber(displayVideos[0].play_count)
                      : 0}
                  </div>
                  <div className="text-sm text-yellow-600">最高播放</div>
                </div>
              </div>
            </div>

            {/* 原始数据表格 */}
            {showRawData && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  去重前数据 ({rawVideos.length} 条)
                </h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          作者
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          播放量
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          点赞数
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          发布时间
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          视频链接
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rawVideos.map((video, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {video.author}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {formatNumber(video.play_count)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {formatNumber(video.like_count)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {new Date(video.publish_time).toLocaleDateString(
                              "zh-CN"
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <a
                              href={video.work_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline truncate block max-w-xs"
                            >
                              {video.work_url}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* 右侧：调试日志 */}
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">调试日志</h2>
                <button
                  onClick={() => setDebugLogs([])}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  清空
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {debugLogs.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">暂无日志</div>
                ) : (
                  debugLogs.map((log, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded text-sm ${
                        log.type === "error"
                          ? "bg-red-50 text-red-800"
                          : log.type === "success"
                          ? "bg-green-50 text-green-800"
                          : log.type === "warning"
                          ? "bg-yellow-50 text-yellow-800"
                          : "bg-blue-50 text-blue-800"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{log.message}</span>
                        <span className="text-xs opacity-75">
                          {log.timestamp}
                        </span>
                      </div>
                      {log.data && (
                        <div className="text-xs mt-1 opacity-75">
                          {JSON.stringify(log.data, null, 2)}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 去重后数据 */}
            {uniqueVideos.length > 0 && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  去重后数据 ({uniqueVideos.length} 条)
                </h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {uniqueVideos.slice(0, displayCount).map((video, index) => (
                    <div
                      key={video.work_url}
                      className="border-l-4 border-blue-500 pl-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          #{index + 1} {video.author}
                        </span>
                        <span className="text-sm text-gray-600">
                          {formatNumber(video.play_count)} 播放
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatNumber(video.like_count)} 点赞 •{" "}
                        {new Date(video.publish_time).toLocaleDateString(
                          "zh-CN"
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
