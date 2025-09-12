# TikTok数据可视化系统 - Design Document

## Overview

TikTok数据可视化系统采用模块化设计，基于现有Next.js架构扩展，添加账号管理和数据分析功能。核心设计理念：

- **渐进式增强**：在现有上传系统基础上添加可视化功能，不影响原有功能
- **响应式设计**：支持桌面端和移动端的良好用户体验
- **实时交互**：状态修改实时保存，统计数据动态更新
- **性能优化**：采用分页加载、虚拟滚动等技术处理大量账号数据

系统采用前后端分离架构，通过RESTful API提供数据服务，前端负责交互和展示。

## Architecture

### 整体架构图
```
┌─────────────────────────────────────────────────────┐
│                    Frontend Layer                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   Upload    │  │  Dashboard  │  │   Accounts  │  │
│  │    Page     │  │    Page     │  │    Page     │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────┐
│                     API Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │/api/upload  │  │/api/accounts│  │/api/stats   │  │
│  │             │  │             │  │             │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────┐
│                   Service Layer                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │DataProcessor│  │AccountService│  │StatsService │  │
│  │   Service   │  │             │  │             │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────┐
│                  Database Layer                     │
│               tiktok_videos_raw                     │
│         (包含 author_status 字段)                    │
└─────────────────────────────────────────────────────┘
```

### 核心模块设计

#### 1. 前端路由结构
```
/                    - 数据上传页面 (现有)
/dashboard           - 数据概览页面 (新增)
/accounts            - 账号管理页面 (新增)
/accounts/[author]   - 单个账号详情页面 (新增)
```

#### 2. API接口设计
```
GET  /api/accounts           - 获取账号列表(支持分页、搜索、筛选)
PUT  /api/accounts/[author]  - 更新单个账号状态
PUT  /api/accounts/batch     - 批量更新账号状态
GET  /api/stats              - 获取统计数据
GET  /api/stats/export       - 导出账号数据
```

## Components and Interfaces

### 前端组件架构

#### 1. 页面级组件

**DashboardPage** - 数据概览页面
```typescript
interface DashboardPageProps {}
interface DashboardState {
  stats: DashboardStats;
  loading: boolean;
  error: string | null;
}
```

**AccountsPage** - 账号管理页面
```typescript
interface AccountsPageProps {}
interface AccountsPageState {
  accounts: Account[];
  filters: AccountFilters;
  selectedAccounts: string[];
  pagination: PaginationState;
  loading: boolean;
}
```

#### 2. 功能组件

**AccountList** - 账号列表组件
```typescript
interface AccountListProps {
  accounts: Account[];
  onStatusChange: (author: string, status: AccountStatus) => void;
  onBatchSelect: (authors: string[]) => void;
  selectedAccounts: string[];
}
```

**AccountCard** - 账号卡片组件
```typescript
interface AccountCardProps {
  account: Account;
  onStatusChange: (author: string, status: AccountStatus) => void;
  onSelect: (author: string, selected: boolean) => void;
  selected: boolean;
}
```

**StatusSelector** - 状态选择器组件
```typescript
interface StatusSelectorProps {
  currentStatus: AccountStatus | null;
  onChange: (status: AccountStatus | null) => void;
  disabled?: boolean;
}
```

**AccountFilters** - 筛选组件
```typescript
interface AccountFiltersProps {
  filters: AccountFilters;
  onChange: (filters: AccountFilters) => void;
  onReset: () => void;
}
```

**StatsOverview** - 统计概览组件
```typescript
interface StatsOverviewProps {
  stats: DashboardStats;
  loading?: boolean;
}
```

#### 3. 通用组件

**SearchBar** - 搜索栏组件
```typescript
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}
```

**Pagination** - 分页组件
```typescript
interface PaginationProps {
  current: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}
```

### 后端服务架构

#### 1. AccountService - 账号服务
```typescript
class AccountService {
  async getAccounts(params: GetAccountsParams): Promise<AccountsResponse>;
  async updateAccountStatus(author: string, status: AccountStatus): Promise<void>;
  async batchUpdateStatus(authors: string[], status: AccountStatus): Promise<void>;
  async getAccountDetail(author: string): Promise<AccountDetail>;
}
```

#### 2. StatsService - 统计服务
```typescript
class StatsService {
  async getDashboardStats(): Promise<DashboardStats>;
  async getStatusDistribution(): Promise<StatusDistribution>;
  async exportAccountsData(filters?: AccountFilters): Promise<Buffer>;
}
```

## Data Models

### 1. 核心数据类型

**Account** - 账号信息
```typescript
interface Account {
  author: string;                    // 账号名称
  status: AccountStatus | null;      // 账号状态
  worksCount: number;               // 作品数量
  totalPlays: number;               // 总播放量
  totalLikes: number;               // 总点赞量
  totalComments: number;            // 总评论量
  totalShares: number;              // 总分享量
  avgPlays: number;                 // 平均播放量
  avgLikes: number;                 // 平均点赞量
  fansCount: number | null;         // 粉丝数
  firstPublishTime: Date | null;    // 首次发布时间
  lastPublishTime: Date | null;     // 最新发布时间
  createdAt: Date;                  // 创建时间
  updatedAt: Date;                  // 更新时间
}
```

**AccountStatus** - 账号状态枚举
```typescript
enum AccountStatus {
  FINISHED = '成品号',
  SEMI_FINISHED = '半成品号'
}
```

**AccountFilters** - 筛选条件
```typescript
interface AccountFilters {
  search?: string;                  // 搜索关键词
  status?: AccountStatus | 'unset'; // 状态筛选
  minWorks?: number;               // 最少作品数
  minPlays?: number;               // 最少播放量
  sortBy?: 'author' | 'worksCount' | 'totalPlays' | 'avgPlays';
  sortOrder?: 'asc' | 'desc';
}
```

### 2. API响应类型

**AccountsResponse** - 账号列表响应
```typescript
interface AccountsResponse {
  data: Account[];
  pagination: {
    current: number;
    total: number;
    pageSize: number;
    totalPages: number;
  };
  filters: AccountFilters;
}
```

**DashboardStats** - 统计数据
```typescript
interface DashboardStats {
  totalAccounts: number;            // 总账号数
  finishedAccounts: number;         // 成品号数量
  semiFinishedAccounts: number;     // 半成品号数量
  unsetAccounts: number;            // 未分类账号数量
  totalWorks: number;               // 总作品数
  totalPlays: number;               // 总播放量
  avgWorksPerAccount: number;       // 平均每账号作品数
  statusDistribution: StatusDistribution[];
}
```

**StatusDistribution** - 状态分布
```typescript
interface StatusDistribution {
  status: AccountStatus | 'unset';
  count: number;
  percentage: number;
  avgPlays: number;
  avgLikes: number;
}
```

### 3. 数据库查询优化

**索引策略**
```sql
-- 为author字段创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_author ON tiktok_videos_raw(author);

-- 为author_status字段创建索引
CREATE INDEX IF NOT EXISTS idx_author_status ON tiktok_videos_raw(author_status);

-- 为复合查询创建索引
CREATE INDEX IF NOT EXISTS idx_author_status_created 
ON tiktok_videos_raw(author, author_status, created_at);
```

**查询优化**
- 使用GROUP BY优化账号统计查询
- 采用LIMIT和OFFSET实现分页
- 使用COUNT(DISTINCT author)优化计数查询

## Error Handling

### 错误处理策略

#### 1. 前端错误处理

**网络错误处理**
```typescript
class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public details?: any
  ) {
    super(message);
  }
}

const handleApiError = (error: ApiError) => {
  switch (error.status) {
    case 400: return '请求参数错误';
    case 404: return '账号不存在';
    case 500: return '服务器内部错误';
    default: return '网络请求失败';
  }
};
```

**用户操作错误**
- 状态修改失败时显示具体错误信息
- 批量操作部分失败时显示成功/失败数量
- 网络请求超时时提供重试选项

#### 2. 后端错误处理

**数据验证错误**
```typescript
class ValidationError extends Error {
  constructor(
    public field: string,
    public message: string
  ) {
    super(`Validation failed for ${field}: ${message}`);
  }
}
```

**数据库操作错误**
```typescript
class DatabaseError extends Error {
  constructor(
    public operation: string,
    public originalError: Error
  ) {
    super(`Database operation failed: ${operation}`);
  }
}
```

#### 3. 错误恢复机制

**乐观更新策略**
- 状态修改立即反映在UI上
- 请求失败时回滚UI状态
- 显示错误消息并提供重试选项

**批量操作容错**
- 单个账号状态修改失败不影响其他账号
- 记录失败的账号列表
- 提供重试失败操作的选项

## Testing Strategy

### 测试策略概述

采用分层测试策略，确保账号管理功能的可靠性和用户体验。

#### 1. 单元测试

**服务层测试**
```typescript
describe('AccountService', () => {
  test('获取账号列表', async () => {
    // 测试分页、搜索、筛选功能
  });
  
  test('更新账号状态', async () => {
    // 测试状态更新和数据库保存
  });
  
  test('批量更新状态', async () => {
    // 测试批量操作和事务处理
  });
});

describe('StatsService', () => {
  test('计算统计数据', async () => {
    // 测试统计计算的准确性
  });
});
```

**组件测试**
```typescript
describe('AccountList', () => {
  test('渲染账号列表', () => {
    // 测试列表渲染和数据显示
  });
  
  test('状态修改交互', () => {
    // 测试状态选择和更新
  });
  
  test('批量选择功能', () => {
    // 测试多选和批量操作
  });
});
```

#### 2. 集成测试

**API集成测试**
```typescript
describe('Accounts API', () => {
  test('GET /api/accounts 完整流程', async () => {
    // 测试从数据库查询到API响应的完整流程
  });
  
  test('PUT /api/accounts/[author] 状态更新', async () => {
    // 测试状态更新的完整流程
  });
});
```

#### 3. 端到端测试

**用户工作流测试**
```typescript
describe('账号管理工作流', () => {
  test('查看账号列表 → 筛选 → 设置状态', async () => {
    // 模拟用户完整操作流程
  });
  
  test('批量操作工作流', async () => {
    // 测试批量选择和状态设置
  });
});
```

#### 4. 性能测试

**大数据量测试**
- 1000个账号的列表加载性能
- 批量更新100个账号状态的响应时间
- 统计数据计算的性能

#### 5. 测试数据准备

**Mock数据生成**
```typescript
const generateMockAccounts = (count: number): Account[] => {
  return Array.from({ length: count }, (_, i) => ({
    author: `test_author_${i}`,
    status: Math.random() > 0.5 ? AccountStatus.FINISHED : null,
    worksCount: Math.floor(Math.random() * 100) + 1,
    totalPlays: Math.floor(Math.random() * 1000000),
    // ... 其他字段
  }));
};
```