// 通用类型定义

// 基础颜色类型
export type Color = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

// 尺寸类型
export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// 状态类型
export type Status = 'idle' | 'loading' | 'success' | 'error';

// 排序方向
export type SortDirection = 'asc' | 'desc';

// 键值对类型
export type KeyValuePair<T = any> = {
  key: string;
  value: T;
  label?: string;
};

// 选项类型（用于下拉菜单等）
export interface Option<T = any> {
  value: T;
  label: string;
  disabled?: boolean;
  description?: string;
}

// 分页配置
export interface PaginationConfig {
  defaultPage?: number;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  showTotal?: boolean;
}

// 表格列定义
export interface TableColumn<T = any> {
  key: string;
  title: string;
  dataIndex?: keyof T;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, record: T, index: number) => React.ReactNode;
}

// 表单字段类型
export interface FormField<T = any> {
  name: keyof T;
  label: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'date' | 'daterange' | 'switch' | 'textarea';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  options?: Option[];
  validation?: ValidationRule[];
}

// 验证规则
export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: any;
  message: string;
  validator?: (value: any) => boolean;
}

// 模态框类型
export interface ModalConfig {
  title: string;
  content: React.ReactNode;
  width?: number | string;
  closable?: boolean;
  maskClosable?: boolean;
  footer?: React.ReactNode;
  onOk?: () => void | Promise<void>;
  onCancel?: () => void;
}

// 通知类型
export interface NotificationConfig {
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message?: string;
  duration?: number;
  closable?: boolean;
}

// 确认对话框配置
export interface ConfirmConfig {
  title: string;
  content: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  okText?: string;
  cancelText?: string;
  onOk: () => void | Promise<void>;
  onCancel?: () => void;
}

// 加载配置
export interface LoadingConfig {
  spinning: boolean;
  tip?: string;
  size?: Size;
  delay?: number;
}

// 主题配置
export interface ThemeConfig {
  primaryColor?: string;
  secondaryColor?: string;
  successColor?: string;
  warningColor?: string;
  errorColor?: string;
  infoColor?: string;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
}

// 图标类型
export type IconType = 
  | 'user' 
  | 'users' 
  | 'chart' 
  | 'bar-chart' 
  | 'pie-chart' 
  | 'trending-up' 
  | 'trending-down'
  | 'eye'
  | 'heart'
  | 'message-circle'
  | 'share'
  | 'bookmark'
  | 'play'
  | 'calendar'
  | 'clock'
  | 'search'
  | 'filter'
  | 'sort'
  | 'refresh'
  | 'download'
  | 'upload'
  | 'edit'
  | 'delete'
  | 'more'
  | 'chevron-up'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'check'
  | 'x'
  | 'plus'
  | 'minus'
  | 'info'
  | 'warning'
  | 'error'
  | 'success';

// 响应式断点
export interface Breakpoints {
  xs: number;    // 0px
  sm: number;    // 640px
  md: number;    // 768px
  lg: number;    // 1024px
  xl: number;    // 1280px
  '2xl': number; // 1536px
}

// 响应式值类型
export type ResponsiveValue<T> = T | {
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
};

// 时间格式类型
export type DateFormat = 
  | 'YYYY-MM-DD'
  | 'YYYY-MM-DD HH:mm:ss'
  | 'MM/DD/YYYY'
  | 'DD/MM/YYYY'
  | 'YYYY年MM月DD日'
  | 'MM月DD日'
  | 'HH:mm:ss';

// 数字格式化选项
export interface NumberFormatOptions {
  decimals?: number;
  thousandsSeparator?: string;
  decimalSeparator?: string;
  prefix?: string;
  suffix?: string;
}

// 文件类型
export interface FileInfo {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  url?: string;
}

// 拖拽类型
export interface DragItem {
  id: string;
  type: string;
  data: any;
}

// 拖拽结果
export interface DropResult {
  item: DragItem;
  dropTargetId: string;
  position?: 'before' | 'after' | 'inside';
}