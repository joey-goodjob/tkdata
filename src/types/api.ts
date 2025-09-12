// API相关类型定义

// 通用API响应格式
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
  timestamp?: string;
}

// API错误类型
export interface ApiError {
  code: string;                     // 错误代码
  message: string;                  // 错误消息
  details?: any;                    // 错误详情
  status?: number;                  // HTTP状态码
  field?: string;                   // 相关字段（验证错误时）
  timestamp: Date;                  // 错误时间
}

// API错误代码枚举
export enum ApiErrorCode {
  // 通用错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  
  // 数据库错误
  DATABASE_ERROR = 'DATABASE_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  QUERY_ERROR = 'QUERY_ERROR',
  
  // 验证错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_FIELD = 'MISSING_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  
  // 业务逻辑错误
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  INVALID_STATUS = 'INVALID_STATUS',
  BATCH_UPDATE_FAILED = 'BATCH_UPDATE_FAILED',
  EXPORT_FAILED = 'EXPORT_FAILED',
}

// HTTP方法类型
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// API请求配置
export interface ApiRequestConfig {
  method: HttpMethod;
  url: string;
  data?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
}

// API响应拦截器配置
export interface ApiInterceptorConfig {
  onRequest?: (config: ApiRequestConfig) => ApiRequestConfig;
  onResponse?: <T>(response: ApiResponse<T>) => ApiResponse<T>;
  onError?: (error: ApiError) => Promise<ApiError>;
}