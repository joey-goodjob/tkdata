# TikTok数据上传系统 - Design Document

## Overview

本设计采用Next.js全栈架构，提供简洁的Excel文件上传界面和强大的后端数据处理能力。系统核心设计理念是：

- **单一职责**：专注于Excel数据上传功能，避免功能过载
- **性能优先**：分批处理大量数据，避免内存溢出和超时
- **用户友好**：实时进度反馈，清晰的错误提示
- **数据安全**：遇错停止机制，确保数据完整性

系统采用前后端分离的API设计，前端负责用户交互，后端专注数据处理，通过WebSocket实现实时进度通信。

## Architecture

### 系统架构图
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端 UI       │    │   Next.js API   │    │  PostgreSQL     │
│                 │    │                 │    │                 │
│ - 文件选择器     │───▶│ - /api/upload   │───▶│ tiktok_videos_ │
│ - 进度条        │◄───│ - Excel解析     │    │ raw表          │
│ - 结果显示      │    │ - 数据映射      │    │                 │
│                 │    │ - 分批插入      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │
        └───────────────────────┘
           WebSocket实时通信
```

### 核心组件

1. **前端层 (Frontend)**
   - React组件：文件上传、进度显示、结果反馈
   - 状态管理：上传进度、处理结果
   - WebSocket客户端：接收实时进度更新

2. **API层 (Backend)**
   - `/api/upload`：主要上传处理API
   - Excel解析引擎：使用xlsx库
   - 数据映射器：字段名称匹配和类型转换
   - 批处理器：500行/批的数据插入

3. **数据层 (Database)**
   - PostgreSQL连接池管理
   - 事务处理确保数据一致性
   - 现有tiktok_videos_raw表结构

## Components and Interfaces

### 前端组件

#### 1. UploadPage 主页面
```typescript
interface UploadPageProps {}
interface UploadPageState {
  file: File | null;
  uploading: boolean;
  progress: number;
  result: UploadResult | null;
  error: string | null;
}
```

#### 2. FileUploader 文件选择组件
```typescript
interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  accept: string; // ".xlsx,.xls"
  maxSize: number; // 50MB
  disabled: boolean;
}
```

#### 3. ProgressBar 进度条组件
```typescript
interface ProgressBarProps {
  progress: number; // 0-100
  message: string;
  showPercentage: boolean;
}
```

#### 4. ResultDisplay 结果显示组件
```typescript
interface ResultDisplayProps {
  result: UploadResult;
  onReset: () => void;
}
```

### 后端API接口

#### 1. POST /api/upload
```typescript
// 请求
interface UploadRequest {
  file: FormData; // Excel文件
}

// 响应
interface UploadResponse {
  success: boolean;
  data?: {
    totalRows: number;
    insertedRows: number;
    processingTime: number;
  };
  error?: string;
}
```

#### 2. WebSocket /api/ws
```typescript
interface ProgressMessage {
  type: 'progress' | 'error' | 'complete';
  progress: number;
  message: string;
  data?: any;
}
```

### 核心服务类

#### 1. ExcelParser 解析器
```typescript
class ExcelParser {
  parseFile(file: Buffer): Promise<RawData[]>;
  validateHeaders(headers: string[]): boolean;
  normalizeData(rowData: any): TiktokRawData;
}
```

#### 2. DatabaseService 数据库服务
```typescript
class DatabaseService {
  connect(): Promise<void>;
  insertBatch(data: TiktokRawData[], batchSize: number): Promise<void>;
  disconnect(): Promise<void>;
}
```

#### 3. UploadProcessor 上传处理器
```typescript
class UploadProcessor {
  processFile(file: File, onProgress: (progress: number) => void): Promise<UploadResult>;
  validateFile(file: File): ValidationResult;
}
```

## Data Models

### 1. TikTok原始数据类型
```typescript
interface TiktokRawData {
  is_selected?: boolean;
  serial_number?: string;
  work_id?: string;
  work_type?: string;
  extract_type?: string;
  search_keyword?: string;
  author?: string;
  author_fans_count?: number;
  author_homepage?: string;
  author_homepage_note?: string;
  author_uid?: string;
  author_sec_uid?: string;
  work_title?: string;
  play_count?: number;
  like_count?: number;
  comment_count?: number;
  collect_count?: number;
  share_count?: number;
  work_quality?: string;
  work_duration?: string;
  work_duration_seconds?: number;
  work_url?: string;
  publish_time?: Date;
  work_note?: string;
  cover_url?: string;
  disable_download?: boolean;
  video_source_url?: string;
  image_download_url?: string;
  image_music_download_url?: string;
  video_id?: string;
  topic_content?: string;
  download_status?: string;
  save_path?: string;
  is_voice_transcribed?: boolean;
}
```

### 2. 上传结果类型
```typescript
interface UploadResult {
  success: boolean;
  totalRows: number;
  insertedRows: number;
  processingTime: number; // 毫秒
  errors?: string[];
}
```

### 3. 字段映射配置
```typescript
interface FieldMapping {
  [dbField: string]: string[]; // 数据库字段 -> 可能的Excel列名数组
}

const FIELD_MAPPINGS: FieldMapping = {
  work_id: ["作品id", "作品ID", "work_id", "id"],
  author: ["作品作者", "作者", "author", "账号名", "用户名"],
  play_count: ["播放量", "观看量", "play_count", "views"],
  // ... 其他34个字段映射
};
```

### 4. 数据验证规则
```typescript
interface ValidationRule {
  field: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'date';
  maxLength?: number;
  customValidator?: (value: any) => boolean;
}
```

### 5. 错误信息类型
```typescript
interface ProcessingError {
  row: number;
  field: string;
  value: any;
  message: string;
  type: 'validation' | 'conversion' | 'database';
}
```

## Error Handling

### 错误处理策略

#### 1. 分层错误处理

**前端错误处理**
- 文件选择验证：格式、大小检查
- 网络错误：连接超时、上传失败
- 用户交互错误：重复提交、无效操作

**API层错误处理**
- 文件解析错误：Excel格式损坏、编码问题
- 数据验证错误：必填字段缺失、类型转换失败
- 数据库错误：连接失败、SQL错误

**数据库层错误处理**
- 连接池管理：自动重连、连接数限制
- 事务处理：失败回滚、数据一致性
- 约束违反：唯一键冲突、外键约束

#### 2. 错误类型定义

```typescript
enum ErrorType {
  FILE_FORMAT = 'FILE_FORMAT',
  FILE_SIZE = 'FILE_SIZE', 
  PARSING_ERROR = 'PARSING_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

interface SystemError {
  type: ErrorType;
  message: string;
  details?: any;
  row?: number;
  field?: string;
}
```

#### 3. 错误处理流程

1. **立即停止策略**：任何错误发生时立即停止处理
2. **错误收集**：记录详细的错误信息和位置
3. **用户反馈**：提供清晰的错误描述和解决建议
4. **日志记录**：服务器端详细日志用于调试

#### 4. 用户友好的错误消息

```typescript
const ERROR_MESSAGES = {
  [ErrorType.FILE_FORMAT]: '请选择有效的Excel文件(.xlsx或.xls)',
  [ErrorType.FILE_SIZE]: '文件大小不能超过50MB',
  [ErrorType.PARSING_ERROR]: 'Excel文件格式错误或已损坏',
  [ErrorType.VALIDATION_ERROR]: '数据验证失败',
  [ErrorType.DATABASE_ERROR]: '数据库操作失败，请稍后重试',
  [ErrorType.NETWORK_ERROR]: '网络连接错误，请检查网络状态'
};
```

## Testing Strategy

### 测试策略概述

采用多层次测试策略，确保系统的可靠性和用户需求的满足：

#### 1. 单元测试 (Unit Tests)

**测试目标：核心功能模块**

```typescript
// Excel解析器测试
describe('ExcelParser', () => {
  test('正确解析标准Excel文件', () => {});
  test('处理中英文混合列名', () => {});
  test('数据类型转换正确性', () => {});
  test('日期格式解析', () => {});
});

// 数据映射器测试
describe('DataMapper', () => {
  test('字段映射准确性', () => {});
  test('数值字段清洗', () => {});
  test('布尔字段转换', () => {});
});

// 数据库服务测试
describe('DatabaseService', () => {
  test('分批插入功能', () => {});
  test('事务回滚机制', () => {});
  test('连接池管理', () => {});
});
```

#### 2. 集成测试 (Integration Tests)

**测试目标：API端到端流程**

```typescript
describe('Upload API Integration', () => {
  test('完整上传流程', async () => {
    // 模拟Excel文件上传
    // 验证数据库插入结果
    // 检查返回结果正确性
  });
  
  test('大文件处理性能', async () => {
    // 5000行数据处理时间 < 2分钟
  });
  
  test('错误处理流程', async () => {
    // 验证各种错误场景的处理
  });
});
```

#### 3. 前端组件测试 (Component Tests)

**使用React Testing Library**

```typescript
describe('FileUploader Component', () => {
  test('文件选择功能', () => {});
  test('文件大小验证', () => {});
  test('格式限制检查', () => {});
});

describe('ProgressBar Component', () => {
  test('进度显示正确性', () => {});
  test('实时更新功能', () => {});
});
```

#### 4. 性能测试 (Performance Tests)

**测试场景**
- 50MB Excel文件上传时间
- 5000行数据处理内存使用
- 并发上传性能
- 数据库连接池效率

#### 5. 验收测试 (Acceptance Tests)

**基于需求文档的22个验收标准**

```typescript
describe('Acceptance Tests', () => {
  test('支持.xlsx和.xls格式文件', () => {});
  test('文件大小50MB限制', () => {});
  test('34个字段完整映射', () => {});
  test('中英文列名自动识别', () => {});
  test('500行分批处理', () => {});
  test('允许重复work_id', () => {});
  test('实时进度显示', () => {});
  test('错误时立即停止', () => {});
  // ... 其他14个验收测试
});
```

#### 6. 测试数据准备

**测试用例文件**
- `test-data-valid.xlsx`：标准格式测试数据
- `test-data-chinese.xlsx`：中文列名测试数据
- `test-data-large.xlsx`：大量数据性能测试
- `test-data-invalid.xlsx`：格式错误测试数据
- `test-data-mixed.xlsx`：混合数据类型测试

#### 7. 测试环境配置

```typescript
// 测试数据库配置
const testDbConfig = {
  host: 'localhost',
  database: 'tkdata_test',
  // 隔离的测试环境
};

// Mock数据配置
const mockTiktokData = {
  // 标准测试数据集
};
```

#### 8. CI/CD测试流水线

1. **提交阶段**：单元测试 + 代码覆盖率检查
2. **构建阶段**：集成测试 + 性能测试
3. **部署前**：验收测试 + 用户界面测试
