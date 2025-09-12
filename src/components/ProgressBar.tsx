'use client';

import React from 'react';

export interface ProgressBarProps {
  progress: number; // 0-100
  message?: string;
  showPercentage?: boolean;
  status?: 'uploading' | 'processing' | 'completed' | 'error';
  estimatedTime?: number; // seconds
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  message = '正在处理...',
  showPercentage = true,
  status = 'processing',
  estimatedTime
}) => {
  // 限制进度值在0-100之间
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  // 根据状态获取颜色
  const getProgressColor = () => {
    switch (status) {
      case 'uploading':
        return 'bg-blue-500';
      case 'processing':
        return 'bg-indigo-500';
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // 根据状态获取背景色
  const getBackgroundColor = () => {
    switch (status) {
      case 'uploading':
        return 'bg-blue-100';
      case 'processing':
        return 'bg-indigo-100';
      case 'completed':
        return 'bg-green-100';
      case 'error':
        return 'bg-red-100';
      default:
        return 'bg-gray-100';
    }
  };

  // 格式化时间
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}分${remainingSeconds}秒`;
  };

  // 获取状态图标
  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
        return (
          <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'processing':
        return (
          <svg className="w-5 h-5 text-indigo-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case 'completed':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* 状态和消息 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className="text-sm font-medium text-gray-700">
            {message}
          </span>
        </div>
        
        {showPercentage && (
          <span className="text-sm font-medium text-gray-600">
            {clampedProgress.toFixed(0)}%
          </span>
        )}
      </div>

      {/* 进度条 */}
      <div className={`w-full h-2 rounded-full ${getBackgroundColor()}`}>
        <div
          className={`h-2 rounded-full transition-all duration-300 ease-out ${getProgressColor()}`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>

      {/* 额外信息 */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {status === 'uploading' && '正在上传文件...'}
          {status === 'processing' && '正在处理数据...'}
          {status === 'completed' && '处理完成'}
          {status === 'error' && '处理失败'}
        </span>
        
        {estimatedTime && estimatedTime > 0 && status !== 'completed' && status !== 'error' && (
          <span>
            预计剩余: {formatTime(estimatedTime)}
          </span>
        )}
      </div>
    </div>
  );
};