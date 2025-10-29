"use client";

import React, { useState, useEffect } from "react";
import { StatsOverview } from "@/components/StatsOverview";
import { DashboardStats } from "@/components/DashboardStats";
import { DashboardCharts } from "@/components/DashboardCharts";

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState<string>("");
  // 🔄 串行加载控制：控制组件依次加载，避免同时发起大量数据库查询
  const [dashboardStatsLoaded, setDashboardStatsLoaded] = useState(false);
  const [statsOverviewLoaded, setStatsOverviewLoaded] = useState(false);

  // 🔄 新增：页面级别的日期状态管理
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // 优先从 localStorage 读取用户上次选择的日期
    if (typeof window !== 'undefined') {
      const savedDate = localStorage.getItem('dashboard-selected-date');
      if (savedDate) {
        return savedDate;
      }
    }
    // 如果没有保存的日期，使用当前日期的前一天
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split("T")[0];
  });

  // 🔄 处理日期变化的回调
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    // 保存用户选择的日期到 localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard-selected-date', newDate);
    }
  };

  useEffect(() => {
    setCurrentTime(new Date().toLocaleString("zh-CN"));
  }, []);

  return (
    <div className="bg-gray-50">
      {/* 页面头部 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                数据仪表板
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                查看TikTok账号和作品的统计分析数据
                {!dashboardStatsLoaded && (
                  <span className="text-blue-600"> • 正在加载统计数据...</span>
                )}
                {dashboardStatsLoaded && !statsOverviewLoaded && (
                  <span className="text-blue-600"> • 正在加载概览数据...</span>
                )}
                {statsOverviewLoaded && (
                  <span className="text-blue-600"> • 正在加载图表数据...</span>
                )}
              </p>
            </div>
            <div className="mt-4 md:mt-0 md:ml-4 flex space-x-3">
              <button
                onClick={() => (window.location.href = "/accounts")}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                管理账号
              </button>
              <button
                onClick={() =>
                  (window.location.href =
                    "/api/stats/export?type=stats&format=excel")
                }
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                导出数据
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 🎯 第一步：Dashboard统计模块（最优先） */}
        <DashboardStats
          className="mb-8"
          initialDate={selectedDate}
          onDateChange={handleDateChange}
          onLoadComplete={() => setDashboardStatsLoaded(true)}
        />

        {/* 🎯 第二步：等第一步完成后再加载统计概览 */}
        {dashboardStatsLoaded && (
          <StatsOverview
            className="mb-8"
            selectedDate={selectedDate}
            onLoadComplete={() => setStatsOverviewLoaded(true)}
          />
        )}

        {/* 🎯 第三步：等第二步完成后再加载图表 */}
        {statsOverviewLoaded && <DashboardCharts className="mb-8" />}

        {/* 快速操作卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div
            className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => (window.location.href = "/accounts")}
          >
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <h3 className="text-lg font-medium text-gray-900">
                    账号管理
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    查看和管理所有TikTok账号，设置账号分类状态
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => (window.location.href = "/")}
          >
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 001.746 3.272l-1.99.632a1 1 0 01-1.266-1.266l.632-1.99A4.001 4.001 0 017 16zm7-4a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <h3 className="text-lg font-medium text-gray-900">
                    数据上传
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    上传新的Excel文件，导入最新的TikTok数据
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
            onClick={() =>
              window.open("/api/stats/export?type=accounts&format=excel")
            }
          >
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <h3 className="text-lg font-medium text-gray-900">
                    数据导出
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    导出账号统计数据为Excel或CSV格式文件
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 最近更新信息 */}
        <div className="bg-white rounded-lg shadow mt-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">系统信息</h3>
          </div>
          <div className="p-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  数据更新时间
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {currentTime || "加载中..."}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">系统版本</dt>
                <dd className="mt-1 text-sm text-gray-900">v1.0.0</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
