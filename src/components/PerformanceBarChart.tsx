"use client";

import React from "react";
import type { TopVideo } from "@/types";

interface PerformanceBarChartProps {
  videos: TopVideo[];
  className?: string;
}

// 数字格式化函数
const formatNumber = (num: number | undefined | null): string => {
  if (num == null || isNaN(num)) return "0";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export function PerformanceBarChart({ videos, className = "" }: PerformanceBarChartProps) {
  if (!videos || videos.length === 0) {
    return (
      <div className={`text-gray-500 text-center py-8 ${className}`}>
        暂无数据
      </div>
    );
  }

  const maxPlays = Math.max(...videos.map((video) => video.play_count));

  return (
    <div className={`space-y-4 ${className}`}>
      {videos.map((video) => {
        const percentage = (video.play_count / maxPlays) * 100;

        return (
          <div key={video.work_url} className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <a
                  href={video.work_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 truncate max-w-32 hover:underline"
                  title="点击打开视频链接"
                >
                  {video.work_url}
                </a>
                <span className="text-xs text-gray-500">
                  作者: {video.author}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {formatNumber(video.play_count)} 播放
              </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
              <div
                className="h-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(percentage, 2)}%` }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>

            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {new Date(video.publish_time).toLocaleDateString("zh-CN", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span>{formatNumber(video.like_count)} 点赞</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}