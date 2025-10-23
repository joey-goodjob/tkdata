// 数据可视化系统类型定义

// 账号状态枚举
export enum AccountStatus {
  FINISHED = '成品号',
  SEMI_FINISHED = '半成品号'
}

// 账号信息接口
export interface Account {
  author: string;                    // 账号名称
  status: AccountStatus | null;      // 账号状态
  phoneNumber: string | null;        // 手机管理编号
  worksCount: number;               // 作品数量
  totalPlays: number;               // 总播放量
  totalLikes: number;               // 总点赞量
  totalComments: number;            // 总评论量
  totalShares: number;              // 总分享量
  totalCollects: number;            // 总收藏量
  avgPlays: number;                 // 平均播放量
  avgLikes: number;                 // 平均点赞量
  avgComments: number;              // 平均评论量
  fansCount: number | null;         // 粉丝数
  firstPublishTime: Date | null;    // 首次发布时间
  lastPublishTime: Date | null;     // 最新发布时间
  createdAt: Date;                  // 创建时间
  updatedAt: Date;                  // 更新时间
  deletedAt?: Date | null;          // 删除时间（软删除）
  isDeleted?: boolean;              // 是否已删除（计算属性）
}

// 账号详细信息（包含作品列表）
export interface AccountDetail extends Account {
  works: AccountWork[];             // 该账号的作品列表
  topWorks: AccountWork[];          // 表现最好的作品（按播放量）
  recentWorks: AccountWork[];       // 最新作品
}

// 账号作品信息
export interface AccountWork {
  workId: string;                   // 作品ID
  title: string;                    // 作品标题
  playCount: number;                // 播放量
  likeCount: number;                // 点赞量
  commentCount: number;             // 评论量
  shareCount: number;               // 分享量
  collectCount: number;             // 收藏量
  publishTime: Date;                // 发布时间
  workUrl: string | null;           // 作品链接
  duration: number | null;          // 视频时长（秒）
  quality: string | null;           // 视频质量
}

// 筛选条件
export interface AccountFilters {
  search?: string;                  // 搜索关键词
  status?: AccountStatus | 'unset' | 'all'; // 状态筛选
  deleted?: 'active' | 'deleted' | 'all'; // 删除状态筛选
  minWorks?: number;               // 最少作品数
  maxWorks?: number;               // 最多作品数
  minPlays?: number;               // 最少播放量
  maxPlays?: number;               // 最多播放量
  minFans?: number;                // 最少粉丝数
  maxFans?: number;                // 最多粉丝数
  dateRange?: {                    // 时间范围
    start: Date;
    end: Date;
  };
  sortBy?: 'author' | 'worksCount' | 'totalPlays' | 'avgPlays' | 'totalLikes' | 'fansCount' | 'lastPublishTime';
  sortOrder?: 'asc' | 'desc';
}

// 分页参数
export interface PaginationParams {
  page: number;                     // 当前页码（从1开始）
  pageSize: number;                 // 每页条数
}

// 分页信息
export interface PaginationInfo {
  current: number;                  // 当前页码
  total: number;                    // 总条数
  pageSize: number;                 // 每页条数
  totalPages: number;               // 总页数
  hasNext: boolean;                 // 是否有下一页
  hasPrev: boolean;                 // 是否有上一页
}

// 通用分页响应类型
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
  total: number;
}

// API响应类型 - 账号列表
export interface AccountsResponse {
  success: boolean;
  data: Account[];
  pagination: PaginationInfo;
  filters: AccountFilters;
  message?: string;
}

// API响应类型 - 单个账号详情
export interface AccountDetailResponse {
  success: boolean;
  data: AccountDetail;
  message?: string;
}

// 统计数据 - 仪表板总览
export interface DashboardStats {
  totalAccounts: number;            // 总账号数
  finishedAccounts: number;         // 成品号数量
  semiFinishedAccounts: number;     // 半成品号数量
  unsetAccounts: number;            // 未分类账号数量
  totalWorks: number;               // 总作品数
  totalPlays: number;               // 总播放量
  totalLikes: number;               // 总点赞量
  avgWorksPerAccount: number;       // 平均每账号作品数
  avgPlaysPerWork: number;          // 平均每作品播放量
  statusDistribution: StatusDistribution[];  // 状态分布
  topAccounts: TopAccount[];        // 表现最好的账号
}

// 状态分布
export interface StatusDistribution {
  status: AccountStatus | 'unset';
  label: string;                    // 显示标签
  count: number;                    // 数量
  percentage: number;               // 占比
  avgPlays: number;                 // 平均播放量
  avgLikes: number;                 // 平均点赞量
  avgWorks: number;                 // 平均作品数
  color: string;                    // 图表颜色
}

// 顶级账号
export interface TopAccount {
  author: string;
  status: AccountStatus | null;
  phoneNumber?: string | null;      // 手机管理编号
  worksCount: number;
  totalPlays: number;
  avgPlays: number;
  rank: number;                     // 排名
}

// 趋势数据
export interface TrendData {
  date: string;                     // 日期
  totalAccounts: number;            // 总账号数
  finishedAccounts: number;         // 成品号数量
  semiFinishedAccounts: number;     // 半成品号数量
  newWorks: number;                 // 新增作品数
  totalPlays: number;               // 总播放量
}

// API请求参数类型
export interface GetAccountsParams extends PaginationParams {
  filters?: Partial<AccountFilters>;
}

// 批量操作参数
export interface BatchUpdateParams {
  authors: string[];                // 账号列表
  status: AccountStatus | null;     // 要设置的状态
}

// 批量操作结果
export interface BatchUpdateResult {
  success: boolean;
  updated: number;                  // 成功更新的数量
  failed: number;                   // 失败的数量
  errors: string[];                 // 错误信息
  details: {
    author: string;
    success: boolean;
    error?: string;
  }[];
}

// 导出数据参数
export interface ExportParams {
  filters?: Partial<AccountFilters>;
  format: 'excel' | 'csv';
  fields?: string[];                // 要导出的字段
}

// 导出结果
export interface ExportResult {
  success: boolean;
  downloadUrl?: string;             // 下载链接
  filename: string;                 // 文件名
  fileSize: number;                 // 文件大小（字节）
  exportedCount: number;            // 导出记录数
  message?: string;
}

// 统计图表数据
export interface ChartData {
  labels: string[];                 // X轴标签
  datasets: ChartDataset[];         // 数据集
}

export interface ChartDataset {
  label: string;                    // 数据集标签
  data: number[];                   // 数据点
  backgroundColor?: string | string[]; // 背景色
  borderColor?: string;             // 边框色
  borderWidth?: number;             // 边框宽度
}

// 组件Props类型

// 账号列表组件Props
export interface AccountListProps {
  accounts: Account[];
  loading?: boolean;
  selectedAccounts: string[];
  onStatusChange: (author: string, status: AccountStatus | null) => void;
  onSelect: (author: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onAccountClick?: (author: string) => void;
}

// 账号卡片组件Props
export interface AccountCardProps {
  account: Account;
  selected: boolean;
  onStatusChange: (author: string, status: AccountStatus | null) => void;
  onSelect: (author: string, selected: boolean) => void;
  onClick?: (author: string) => void;
}

// 状态选择器Props
export interface StatusSelectorProps {
  currentStatus: AccountStatus | null;
  onChange: (status: AccountStatus | null) => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

// 筛选器Props
export interface AccountFiltersProps {
  filters: AccountFilters;
  onChange: (filters: AccountFilters) => void;
  onReset: () => void;
  loading?: boolean;
}

// 搜索框Props
export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  debounceMs?: number;
}

// 分页组件Props
export interface PaginationProps {
  pagination: PaginationInfo;
  onChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  showSizeChanger?: boolean;
  showTotal?: boolean;
}

// 统计卡片Props
export interface StatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

// 图表组件Props
export interface ChartProps {
  data: ChartData;
  type: 'pie' | 'bar' | 'line' | 'doughnut';
  title?: string;
  height?: number;
  options?: any; // Chart.js options
}

// 批量操作栏Props
export interface BatchActionsProps {
  selectedCount: number;
  onSetStatus: (status: AccountStatus | null) => void;
  onClearSelection: () => void;
  loading?: boolean;
}

// 错误处理类型
export interface ApiError {
  status: number;
  message: string;
  details?: any;
  timestamp: Date;
}

// 加载状态类型
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// 表单验证错误
export interface ValidationError {
  field: string;
  message: string;
}

// Hook返回类型
export interface UseAccountsReturn {
  accounts: Account[];
  loading: boolean;
  error: string | null;
  pagination: PaginationInfo;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  updateFilters: (filters: Partial<AccountFilters>) => void;
}

export interface UseAccountDetailReturn {
  account: AccountDetail | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export interface UseDashboardStatsReturn {
  stats: DashboardStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}