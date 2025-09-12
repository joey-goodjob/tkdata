'use client';

import React from 'react';

export interface UploadResult {
  totalRows: number;
  insertedRows: number;
  processingTime: number;
  errors?: string[];
  warnings?: string[];
}

export interface ResultDisplayProps {
  result: UploadResult | null;
  isError?: boolean;
  errorMessage?: string;
  onReset: () => void;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({
  result,
  isError = false,
  errorMessage,
  onReset
}) => {
  if (!result && !isError) {
    return null;
  }

  // 格式化处理时间
  const formatTime = (ms: number): string => {
    if (ms < 1000) {
      return `${ms}毫秒`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}秒`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}分${seconds}秒`;
    }
  };

  // 计算成功率
  const getSuccessRate = (): number => {
    if (!result || result.totalRows === 0) return 0;
    return Math.round((result.insertedRows / result.totalRows) * 100);
  };

  // 错误状态显示
  if (isError) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium text-red-800 mb-2">
                上传失败
              </h3>
              <p className="text-sm text-red-700 mb-4">
                {errorMessage || '文件处理过程中发生错误，请检查文件格式和内容后重试。'}
              </p>
              <button
                onClick={onReset}
                className="bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                重新上传
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 成功状态显示
  if (result) {
    const successRate = getSuccessRate();
    const isFullSuccess = successRate === 100;

    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className={`border rounded-lg p-6 ${
          isFullSuccess 
            ? 'bg-green-50 border-green-200' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          {/* 标题和图标 */}
          <div className="flex items-start space-x-3 mb-4">
            <div className="flex-shrink-0">
              {isFullSuccess ? (
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.856-.833-2.626 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-medium mb-1 ${
                isFullSuccess ? 'text-green-800' : 'text-yellow-800'
              }`}>
                {isFullSuccess ? '上传成功' : '部分成功'}
              </h3>
              <p className={`text-sm ${
                isFullSuccess ? 'text-green-700' : 'text-yellow-700'
              }`}>
                {isFullSuccess 
                  ? '所有数据已成功导入数据库' 
                  : '数据已部分导入，请查看详细信息'
                }
              </p>
            </div>
          </div>

          {/* 统计信息 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {result.totalRows.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">总行数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {result.insertedRows.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">成功导入</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {successRate}%
              </div>
              <div className="text-xs text-gray-600">成功率</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formatTime(result.processingTime)}
              </div>
              <div className="text-xs text-gray-600">处理时间</div>
            </div>
          </div>

          {/* 进度条 */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">处理进度</span>
              <span className="text-sm text-gray-600">{result.insertedRows} / {result.totalRows}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  isFullSuccess ? 'bg-green-500' : 'bg-yellow-500'
                }`}
                style={{ width: `${successRate}%` }}
              />
            </div>
          </div>

          {/* 错误和警告信息 */}
          {(result.errors?.length || result.warnings?.length) && (
            <div className="space-y-3 mb-6">
              {result.errors && result.errors.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-800 mb-2">错误信息：</h4>
                  <div className="bg-red-100 border border-red-200 rounded p-3">
                    <ul className="text-sm text-red-700 space-y-1">
                      {result.errors.slice(0, 5).map((error, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className="text-red-500">•</span>
                          <span>{error}</span>
                        </li>
                      ))}
                      {result.errors.length > 5 && (
                        <li className="text-red-600 font-medium">
                          ... 还有 {result.errors.length - 5} 个错误
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {result.warnings && result.warnings.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-yellow-800 mb-2">警告信息：</h4>
                  <div className="bg-yellow-100 border border-yellow-200 rounded p-3">
                    <ul className="text-sm text-yellow-700 space-y-1">
                      {result.warnings.slice(0, 3).map((warning, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className="text-yellow-500">•</span>
                          <span>{warning}</span>
                        </li>
                      ))}
                      {result.warnings.length > 3 && (
                        <li className="text-yellow-600 font-medium">
                          ... 还有 {result.warnings.length - 3} 个警告
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end">
            <button
              onClick={onReset}
              className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              上传新文件
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};