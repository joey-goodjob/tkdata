# TikTok数据上传系统 PRD

## 1. 项目概述

### 1.1 项目背景
开发一个用于每日上传TikTok数据Excel文件到数据库的Web系统，支持大批量数据处理和进度监控。

### 1.2 项目目标
- 实现Excel文件上传和数据解析功能
- 支持大量数据分批插入数据库（每天几千行）
- 提供实时上传进度反馈
- 确保数据完整性和错误处理

## 2. 技术栈

- **前端框架**: Next.js 14 + TypeScript
- **数据库**: PostgreSQL (Supabase)
- **文件处理**: xlsx库
- **样式**: Tailwind CSS
- **部署**: 本地开发环境

## 3. 功能需求

### 3.1 核心功能

#### 3.1.1 Excel文件上传
- **功能描述**: 支持上传包含TikTok数据的Excel文件
- **文件格式**: .xlsx, .xls
- **数据验证**: 基本格式校验
- **大小限制**: 50MB

#### 3.1.2 数据解析与映射
- **字段映射**: 支持中英文列名自动识别映射
- **数据类型转换**: 
  - 数值类型: play_count, like_count等自动转换
  - 布尔类型: is_selected等字段处理
  - 日期类型: publish_time格式化 (2025-09-07 05:27:12)
  - 字符串类型: 自动trim处理

#### 3.1.3 分批数据插入
- **批次大小**: 500行/批
- **进度显示**: 实时显示上传进度百分比
- **错误处理**: 遇到错误立即停止整个上传过程

#### 3.1.4 结果反馈
- **成功提示**: 显示总共插入的行数
- **失败处理**: 显示具体错误信息和失败位置
- **处理时间**: 显示总耗时

## 4. 数据库设计

### 4.1 目标表结构
使用现有的 `tiktok_videos_raw` 表，包含34个字段：

```sql
CREATE TABLE "tiktok_videos_raw" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "is_selected" boolean DEFAULT false,
    "serial_number" varchar(50),
    "work_id" varchar(255),
    "work_type" varchar(100),
    "extract_type" varchar(100),
    "search_keyword" varchar(255),
    "author" varchar(255),
    "author_fans_count" bigint DEFAULT 0,
    "author_homepage" text,
    "author_homepage_note" text,
    "author_uid" varchar(255),
    "author_sec_uid" varchar(255),
    "work_title" text,
    "play_count" bigint DEFAULT 0,
    "like_count" bigint DEFAULT 0,
    "comment_count" bigint DEFAULT 0,
    "collect_count" bigint DEFAULT 0,
    "share_count" bigint DEFAULT 0,
    "work_quality" varchar(100),
    "work_duration" varchar(50),
    "work_duration_seconds" integer DEFAULT 0,
    "work_url" text,
    "publish_time" timestamp with time zone,
    "work_note" text,
    "cover_url" text,
    "disable_download" boolean DEFAULT false,
    "video_source_url" text,
    "image_download_url" text,
    "image_music_download_url" text,
    "video_id" varchar(255),
    "topic_content" text,
    "download_status" varchar(100),
    "save_path" text,
    "is_voice_transcribed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);
```

### 4.2 数据处理策略
- **重复数据**: 允许相同work_id的数据插入（不同时间采集的更新数据）
- **数据追加**: 所有数据追加到同一张表
- **时间戳**: 自动设置created_at和updated_at

## 5. 技术实现

### 5.1 系统架构
```
前端页面 (Upload UI)
    ↓
Next.js API Route (/api/upload)
    ↓
Excel解析 (xlsx)
    ↓
数据映射 (normalizeRawData)
    ↓
分批插入数据库 (PostgreSQL)
```

### 5.2 核心组件

#### 5.2.1 前端组件
- **UploadPage**: 主上传页面
- **FileUploader**: 文件选择器组件
- **ProgressBar**: 进度条组件
- **ResultDisplay**: 结果显示组件

#### 5.2.2 后端API
- **POST /api/upload**: 处理文件上传和数据插入
- **数据解析**: 使用现有normalizeRawData函数
- **批处理逻辑**: 500行分批插入

### 5.3 错误处理
- **文件格式验证**: 检查Excel文件有效性
- **数据验证**: 必填字段检查
- **数据库错误**: 连接失败、插入失败处理
- **内存管理**: 大文件处理优化

## 6. 用户界面设计

### 6.1 页面布局
```
+------------------------------------------+
|              TikTok数据上传              |
+------------------------------------------+
|                                          |
|    [选择Excel文件]  [上传]                |
|                                          |
|    进度条: ████████░░ 80%                |
|                                          |
|    结果: 成功插入 2,340 条数据            |
|          耗时: 45 秒                     |
|                                          |
+------------------------------------------+
```

### 6.2 交互流程
1. 用户选择Excel文件
2. 点击上传按钮
3. 显示上传进度
4. 显示处理结果

## 7. 项目文件结构

```
tkdata/
├── pages/
│   └── index.tsx                 # 主上传页面
├── pages/api/
│   └── upload.ts                 # 上传API路由
├── components/
│   ├── FileUploader.tsx          # 文件上传组件
│   ├── ProgressBar.tsx           # 进度条组件
│   └── ResultDisplay.tsx         # 结果显示组件
├── lib/
│   ├── database.ts               # 数据库连接
│   └── dataProcessor.ts          # 数据处理逻辑
├── types/
│   └── tiktok.ts                 # TypeScript类型定义
├── .env                          # 环境变量 (已有DATABASE_URL)
└── package.json                  # 项目配置
```

## 8. 开发计划

### Phase 1: 基础上传功能 (优先级最高)
- [x] 需求分析
- [x] 项目初始化和依赖安装
- [x] 数据库连接配置
- [x] Excel文件上传API开发
- [x] 数据解析和映射逻辑
- [x] 分批插入功能
- [x] 基础UI页面

### Phase 2: 优化和完善
- [x] 错误处理完善
- [x] 进度条和用户反馈
- [x] 性能优化
- [x] 测试和调试

### 未来扩展 (后续考虑)
- [ ] 数据可视化功能
- [ ] 历史上传记录
- [ ] 数据验证和清洗
- [ ] 数据导出功能

## 9. 非功能性需求

- **性能**: 支持几千行数据快速处理
- **可靠性**: 错误时停止上传，保证数据一致性
- **用户体验**: 实时进度反馈，清晰的错误提示
- **维护性**: 代码结构清晰，易于后续扩展

## 10. 风险和限制

- **内存限制**: 大文件可能导致内存不足
- **数据库连接**: 网络问题可能影响数据插入
- **Excel格式**: 复杂格式可能解析失败
- **数据质量**: 依赖原始Excel数据的准确性