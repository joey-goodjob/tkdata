'use client';

import React, { useState, useCallback } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { ProgressBar } from '@/components/ProgressBar';
import { ResultDisplay, UploadResult } from '@/components/ResultDisplay';

// 上传状态
type UploadStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

interface ProgressState {
  progress: number;
  message: string;
  estimatedTime?: number;
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [progressState, setProgressState] = useState<ProgressState>({
    progress: 0,
    message: ''
  });
  const [result, setResult] = useState<UploadResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // 处理文件选择
  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setUploadStatus('idle');
    setResult(null);
    setErrorMessage('');
    setProgressState({ progress: 0, message: '' });
  }, []);

  // 处理文件上传
  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    try {
      setUploadStatus('uploading');
      setProgressState({
        progress: 0,
        message: '正在上传文件...'
      });

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      // 模拟上传进度
      for (let i = 0; i <= 100; i += 10) {
        setProgressState({
          progress: i,
          message: i < 30 ? '正在上传文件...' : i < 80 ? '正在解析Excel...' : '正在插入数据库...'
        });
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const data = await response.json();

      if (data.success) {
        setUploadStatus('completed');
        setResult(data.data);
        setProgressState({
          progress: 100,
          message: '处理完成'
        });
      } else {
        throw new Error(data.error?.message || '上传失败');
      }

    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '上传过程中发生未知错误');
      setProgressState({
        progress: 0,
        message: '上传失败'
      });
    }
  }, [selectedFile]);

  // 重置状态
  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setUploadStatus('idle');
    setResult(null);
    setErrorMessage('');
    setProgressState({ progress: 0, message: '' });
  }, []);

  // 判断是否可以上传
  const canUpload = selectedFile && uploadStatus === 'idle';
  const isUploading = uploadStatus === 'uploading' || uploadStatus === 'processing';

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            TikTok数据上传系统
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            上传Excel文件，自动解析并导入TikTok数据到数据库
          </p>
        </div>

        <div className="space-y-8">
          {/* 文件上传区域 */}
          {(uploadStatus === 'idle' || uploadStatus === 'error') && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                选择Excel文件
              </h2>
              <FileUploader
                onFileSelect={handleFileSelect}
                currentFile={selectedFile}
                disabled={isUploading}
              />
              
              {selectedFile && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={handleUpload}
                    disabled={!canUpload}
                    className={`
                      px-6 py-3 rounded-md font-medium transition-colors
                      ${canUpload
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }
                    `}
                  >
                    {isUploading ? '正在上传...' : '开始上传'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 进度显示区域 */}
          {isUploading && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                处理进度
              </h2>
              <ProgressBar
                progress={progressState.progress}
                message={progressState.message}
                status={uploadStatus === 'uploading' ? 'uploading' : 'processing'}
                showPercentage={true}
                estimatedTime={progressState.estimatedTime}
              />
            </div>
          )}

          {/* 结果显示区域 */}
          {(uploadStatus === 'completed' || uploadStatus === 'error') && (
            <ResultDisplay
              result={result}
              isError={uploadStatus === 'error'}
              errorMessage={errorMessage}
              onReset={handleReset}
            />
          )}
        </div>

        {/* 使用说明 */}
        <div className="mt-12 bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            使用说明
          </h2>
          <div className="prose text-sm text-gray-600">
            <ul className="space-y-2">
              <li>• 支持上传 .xlsx 和 .xls 格式的Excel文件</li>
              <li>• 文件大小限制：50MB</li>
              <li>• 系统会自动识别中英文列名并映射到数据库字段</li>
              <li>• 支持的主要字段：作品ID、作者、标题、播放量、点赞量等</li>
              <li>• 数据将分批处理（500行/批），确保处理效率</li>
              <li>• 遇到错误会立即停止处理，确保数据完整性</li>
            </ul>
          </div>
        </div>

        {/* 页脚 */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>TikTok数据上传系统 - 专为高效数据处理而设计</p>
        </div>
      </div>
    </div>
  );
}