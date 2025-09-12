// 统一类型导出文件

// 从现有文件导出
export * from './api';
export * from './common';
export * from './visualization';

// 从数据库文件导出相关类型
export type { 
  TiktokRawData,
  BatchResult,
  BatchInsertResult
} from '../lib/database';

// React相关类型导入
export type { 
  ReactNode, 
  ReactElement, 
  ComponentProps, 
  FC, 
  PropsWithChildren 
} from 'react';

// Next.js相关类型
export type { 
  NextApiRequest, 
  NextApiResponse 
} from 'next';

// 常用工具类型
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

export type Required<T> = {
  [P in keyof T]-?: T[P];
};

export type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

export type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;

export type Record<K extends keyof any, T> = {
  [P in K]: T;
};

// 时间戳类型
export type Timestamp = number | string | Date;

// ID类型
export type ID = string | number;

// 分页相关类型快捷导出
export type {
  PaginationInfo,
  PaginationParams,
  PaginationProps
} from './visualization';

// 账号相关类型快捷导出
export type {
  Account,
  AccountDetail,
  AccountStatus,
  AccountFilters
} from './visualization';

// 统计相关类型快捷导出
export type {
  DashboardStats,
  StatusDistribution,
  TrendData
} from './visualization';

// API相关类型快捷导出
export type {
  ApiResponse,
  ApiError,
  ApiErrorCode
} from './api';

// 组件相关类型快捷导出
export type {
  AccountListProps,
  AccountCardProps,
  StatusSelectorProps,
  AccountFiltersProps
} from './visualization';