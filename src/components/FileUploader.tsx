'use client';

import React, { useCallback, useState } from 'react';

export interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number; // in bytes
  disabled?: boolean;
  currentFile?: File | null;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelect,
  accept = '.xlsx,.xls',
  maxSize = 50 * 1024 * 1024, // 50MB
  disabled = false,
  currentFile
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 验证文件
  const validateFile = useCallback((file: File): string | null => {
    // 检查文件大小
    if (file.size > maxSize) {
      return `文件大小超出限制。最大允许 ${Math.round(maxSize / 1024 / 1024)}MB，当前文件 ${(file.size / 1024 / 1024).toFixed(2)}MB`;
    }

    // 检查文件格式
    const validExtensions = accept.split(',').map(ext => ext.trim().toLowerCase());
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      return `不支持的文件格式。请上传 ${accept} 格式的文件`;
    }

    return null;
  }, [accept, maxSize]);

  // 处理文件选择
  const handleFileSelect = useCallback((file: File) => {
    const validationError = validateFile(file);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    onFileSelect(file);
  }, [validateFile, onFileSelect]);

  // 处理拖拽事件
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  }, [disabled, handleFileSelect]);

  // 处理文件输入
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  // 清除选择的文件
  const clearFile = useCallback(() => {
    setError(null);
  }, []);

  return (
    <div className="w-full">
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${dragActive 
            ? 'border-blue-500 bg-blue-50' 
            : error 
            ? 'border-red-300 bg-red-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => {
          if (!disabled) {
            document.getElementById('file-input')?.click();
          }
        }}
      >
        <input
          id="file-input"
          type="file"
          accept={accept}
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />

        <div className="space-y-4">
          {/* 图标 */}
          <div className="flex justify-center">
            <svg
              className={`w-12 h-12 ${error ? 'text-red-400' : 'text-gray-400'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          {/* 文本 */}
          <div>
            {currentFile ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">
                  已选择文件
                </p>
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-sm text-gray-600">{currentFile.name}</span>
                  <span className="text-xs text-gray-400">
                    ({(currentFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">
                  {dragActive ? '放开文件进行上传' : '点击或拖拽文件到这里上传'}
                </p>
                <p className="text-xs text-gray-500">
                  支持 {accept} 格式，最大 {Math.round(maxSize / 1024 / 1024)}MB
                </p>
              </div>
            )}
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </div>
          )}

          {/* 清除按钮 */}
          {currentFile && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
              disabled={disabled}
            >
              重新选择文件
            </button>
          )}
        </div>
      </div>
    </div>
  );
};