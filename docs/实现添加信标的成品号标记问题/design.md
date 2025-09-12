# 智能保护用户标记的数据合并系统 - Design Document

## Overview

本系统旨在解决Excel数据上传时保护用户手动分类标记的核心业务问题。通过智能冲突检测、灵活合并策略和完整审计追踪，确保用户宝贵的分类工作不被意外覆盖。

### 核心设计理念
- **用户优先**: 默认保护用户手动分类，避免意外数据丢失
- **智能决策**: 提供多种合并策略，适应不同业务场景
- **透明可控**: 完整的操作日志和数据溯源，支持错误恢复
- **性能友好**: 冲突检测和合并操作不显著影响现有上传性能

## Architecture

### 系统分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                     用户界面层 (UI Layer)                      │
├─────────────────────────────────────────────────────────────┤
│  上传组件    │  冲突预览    │  策略选择    │  结果报告         │
└─────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      API服务层 (API Layer)                    │
├─────────────────────────────────────────────────────────────┤
│  上传API     │  冲突检测API │  合并执行API │  审计查询API      │
└─────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                     业务逻辑层 (Service Layer)                 │
├─────────────────────────────────────────────────────────────┤
│ ConflictDetector │ MergeEngine │ AuditService │ BackupService │
└─────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      数据层 (Data Layer)                      │
├─────────────────────────────────────────────────────────────┤
│ tiktok_videos_raw │ merge_operations │ classification_audit  │
└─────────────────────────────────────────────────────────────┘
```

### 核心处理流程

```
Excel上传 → 数据解析 → 冲突检测 → 策略选择 → 智能合并 → 结果报告
    │         │         │         │         │         │
    ▼         ▼         ▼         ▼         ▼         ▼
   验证     提取账号   找出冲突   用户决策   执行合并   记录日志
```

## Components and Interfaces

### 1. ConflictDetector (冲突检测器)

```typescript
interface ConflictDetector {
  /**
   * 检测Excel数据与现有手动分类的冲突
   */
  detectConflicts(
    excelData: ExcelRecord[], 
    existingClassifications: Map<string, ClassificationInfo>
  ): Promise<ConflictAnalysis>;
  
  /**
   * 生成冲突摘要报告
   */
  generateConflictSummary(conflicts: ConflictAnalysis): ConflictSummary;
}

interface ConflictAnalysis {
  totalExcelRecords: number;
  conflictingAccounts: ConflictingAccount[];
  newAccounts: string[];
  exactMatches: string[];
  statisticsUpdates: StatUpdateInfo[];
}

interface ConflictingAccount {
  author: string;
  currentStatus: AccountStatus;  // 用户手动分类
  excelStatus: AccountStatus | null;  // Excel中的状态
  classificationSource: 'manual' | 'import';
  lastModified: Date;
  conflictType: 'status_mismatch' | 'excel_has_null' | 'both_have_values';
}
```

### 2. MergeEngine (合并引擎)

```typescript
interface MergeEngine {
  /**
   * 执行数据合并操作
   */
  executeMerge(
    strategy: MergeStrategy,
    conflicts: ConflictAnalysis,
    excelData: ExcelRecord[]
  ): Promise<MergeResult>;
  
  /**
   * 预览合并结果（不执行实际操作）
   */
  previewMerge(
    strategy: MergeStrategy,
    conflicts: ConflictAnalysis
  ): Promise<MergePreview>;
}

enum MergeStrategy {
  PROTECT_MANUAL = 'protect',      // 保护模式：保留用户分类
  OVERWRITE_ALL = 'overwrite',     // 覆盖模式：Excel优先
  INTERACTIVE = 'interactive'      // 交互模式：用户逐项决定
}

interface MergeResult {
  operationId: string;
  summary: {
    protectedClassifications: number;
    updatedStatistics: number;
    newAccountsAdded: number;
    overwrittenClassifications: number;
  };
  affectedAccounts: string[];
  executionTime: number;
  rollbackSupported: boolean;
}
```

### 3. AuditService (审计服务)

```typescript
interface AuditService {
  /**
   * 记录合并操作
   */
  recordMergeOperation(
    operation: MergeOperation,
    result: MergeResult
  ): Promise<string>;
  
  /**
   * 记录分类变更历史
   */
  recordClassificationChange(
    author: string,
    oldStatus: AccountStatus | null,
    newStatus: AccountStatus | null,
    source: ClassificationSource,
    operationId?: string
  ): Promise<void>;
  
  /**
   * 查询操作历史
   */
  getOperationHistory(
    filters: AuditFilters
  ): Promise<MergeOperation[]>;
  
  /**
   * 支持操作回滚
   */
  rollbackOperation(operationId: string): Promise<RollbackResult>;
}

interface MergeOperation {
  id: string;
  timestamp: Date;
  strategy: MergeStrategy;
  userId?: string;
  conflictCount: number;
  affectedAccountCount: number;
  operationSummary: string;
  rollbackData?: any;  // 用于支持回滚的数据快照
}
```

### 4. BackupService (备份服务)

```typescript
interface BackupService {
  /**
   * 创建操作前的数据备份
   */
  createPreOperationBackup(
    affectedAccounts: string[]
  ): Promise<BackupSnapshot>;
  
  /**
   * 从备份恢复数据
   */
  restoreFromBackup(
    backupId: string,
    targetAccounts?: string[]
  ): Promise<RestoreResult>;
}
```

## Data Models

### 核心数据表设计

#### 1. tiktok_videos_raw (扩展现有表)

```sql
-- 添加新字段来支持数据溯源
ALTER TABLE tiktok_videos_raw ADD COLUMN IF NOT EXISTS 
  classification_source VARCHAR(20) DEFAULT 'import',
  classification_time TIMESTAMP,
  last_import_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  manual_classified BOOLEAN DEFAULT FALSE;

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_classification_tracking 
  ON tiktok_videos_raw(author, classification_source, manual_classified);
CREATE INDEX IF NOT EXISTS idx_classification_time 
  ON tiktok_videos_raw(classification_time) WHERE classification_time IS NOT NULL;
```

#### 2. merge_operations (新表：记录合并操作)

```sql
CREATE TABLE merge_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  strategy VARCHAR(20) NOT NULL,
  user_id VARCHAR(100),
  conflict_count INTEGER DEFAULT 0,
  affected_account_count INTEGER DEFAULT 0,
  operation_summary TEXT,
  rollback_data JSONB,  -- 存储回滚所需的数据快照
  status VARCHAR(20) DEFAULT 'completed',
  execution_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_merge_operations_timestamp ON merge_operations(timestamp);
CREATE INDEX idx_merge_operations_user ON merge_operations(user_id);
```

#### 3. classification_audit (新表：分类变更审计)

```sql
CREATE TABLE classification_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author VARCHAR(255) NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  classification_source VARCHAR(20) NOT NULL,
  operation_id UUID REFERENCES merge_operations(id),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  additional_data JSONB  -- 存储额外的上下文信息
);

CREATE INDEX idx_classification_audit_author ON classification_audit(author);
CREATE INDEX idx_classification_audit_timestamp ON classification_audit(timestamp);
CREATE INDEX idx_classification_audit_operation ON classification_audit(operation_id);
```

### TypeScript类型定义

```typescript
// 扩展现有的账号接口
interface EnhancedAccount extends Account {
  classificationSource: 'manual' | 'import' | 'system';
  classificationTime?: Date;
  lastImportTime?: Date;
  manualClassified: boolean;
}

// 冲突处理相关类型
interface ConflictResolution {
  author: string;
  resolution: 'keep_manual' | 'use_excel' | 'skip';
  userDecision?: boolean;
}

interface BatchConflictResolution {
  globalStrategy?: MergeStrategy;
  individualResolutions?: ConflictResolution[];
  applyToSimilar?: boolean;
}

// 操作结果类型
interface DetailedMergeResult extends MergeResult {
  warnings: string[];
  errors: string[];
  skippedAccounts: string[];
  backupId: string;
  canRollback: boolean;
  rollbackExpiresAt: Date;
}
```

## Error Handling

### 分层错误处理策略

#### 1. 用户输入验证层
```typescript
enum ValidationError {
  INVALID_EXCEL_FORMAT = 'INVALID_EXCEL_FORMAT',
  MISSING_REQUIRED_COLUMNS = 'MISSING_REQUIRED_COLUMNS',
  DUPLICATE_AUTHORS_IN_EXCEL = 'DUPLICATE_AUTHORS_IN_EXCEL',
  INVALID_STATUS_VALUES = 'INVALID_STATUS_VALUES'
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  processableRows: number;
  skippedRows: number;
}
```

#### 2. 业务逻辑层错误处理
```typescript
enum BusinessLogicError {
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  CONFLICT_DETECTION_FAILED = 'CONFLICT_DETECTION_FAILED',
  MERGE_OPERATION_FAILED = 'MERGE_OPERATION_FAILED',
  BACKUP_CREATION_FAILED = 'BACKUP_CREATION_FAILED',
  ROLLBACK_NOT_AVAILABLE = 'ROLLBACK_NOT_AVAILABLE'
}

class MergeEngineError extends Error {
  constructor(
    public errorType: BusinessLogicError,
    public details: any,
    public recoverable: boolean = false
  ) {
    super(`Merge operation failed: ${errorType}`);
  }
}
```

#### 3. 数据完整性保护
```typescript
interface TransactionManager {
  /**
   * 在事务中执行合并操作，确保原子性
   */
  executeInTransaction<T>(operation: () => Promise<T>): Promise<T>;
  
  /**
   * 验证数据完整性
   */
  validateDataIntegrity(
    beforeSnapshot: DataSnapshot,
    afterSnapshot: DataSnapshot
  ): IntegrityCheckResult;
}

interface IntegrityCheckResult {
  isValid: boolean;
  missingRecords: string[];
  unexpectedChanges: string[];
  totalRecordCount: { before: number; after: number };
}
```

### 错误恢复机制

1. **自动重试**: 网络错误和临时数据库连接问题
2. **部分成功处理**: 记录成功处理的记录，只重试失败部分
3. **优雅降级**: 冲突检测失败时，降级到简单的覆盖模式提醒用户
4. **操作回滚**: 支持在错误后完全回滚到操作前状态

## Testing Strategy

### 测试金字塔

#### 1. 单元测试 (70%)
```typescript
describe('ConflictDetector', () => {
  test('should detect status conflicts correctly', () => {
    // 测试状态冲突检测逻辑
  });
  
  test('should handle empty classifications gracefully', () => {
    // 测试空分类情况
  });
  
  test('should identify new accounts correctly', () => {
    // 测试新账号识别
  });
});

describe('MergeEngine', () => {
  test('should preserve manual classifications in protect mode', () => {
    // 测试保护模式
  });
  
  test('should overwrite all in overwrite mode', () => {
    // 测试覆盖模式  
  });
  
  test('should handle interactive resolutions', () => {
    // 测试交互模式
  });
});
```

#### 2. 集成测试 (20%)
```typescript
describe('Upload with Conflict Resolution Integration', () => {
  test('complete workflow: upload → detect → resolve → merge', async () => {
    // 测试完整的工作流程
    const excelData = createMockExcelData();
    const conflicts = await conflictDetector.detectConflicts(excelData);
    const strategy = MergeStrategy.PROTECT_MANUAL;
    const result = await mergeEngine.executeMerge(strategy, conflicts, excelData);
    
    expect(result.summary.protectedClassifications).toBeGreaterThan(0);
    expect(result.rollbackSupported).toBe(true);
  });
  
  test('should handle concurrent uploads safely', async () => {
    // 测试并发上传安全性
  });
});
```

#### 3. E2E测试 (10%)
```typescript
describe('User Conflict Resolution Journey', () => {
  test('user can protect existing classifications during upload', async () => {
    // 完整的用户操作流程测试
    await page.goto('/upload');
    await page.setInputFiles('#excel-file', 'test-data.xlsx');
    await page.click('[data-testid="upload-button"]');
    
    // 验证冲突检测界面
    await expect(page.locator('[data-testid="conflict-summary"]')).toBeVisible();
    await page.click('[data-testid="protect-mode"]');
    await page.click('[data-testid="confirm-merge"]');
    
    // 验证结果报告
    await expect(page.locator('[data-testid="merge-result"]')).toContainText('保留分类');
  });
});
```

### 特殊场景测试

#### 1. 数据边界测试
- 大量冲突数据（1000+ 冲突账号）
- 极少冲突数据（1-2个冲突）
- Excel数据格式异常情况
- 数据库连接异常恢复

#### 2. 性能测试
- 冲突检测性能：10,000条记录 < 2秒
- 合并操作性能：1,000个冲突 < 5秒  
- 内存使用：冲突检测不超过现有使用量50%
- 并发测试：5个用户同时上传

#### 3. 数据一致性测试
- 事务回滚完整性验证
- 审计日志记录完整性
- 分类状态变更追踪准确性
- 操作回滚功能验证

### 测试数据管理
```typescript
interface TestDataFactory {
  createMockExcelData(conflicts: number, newAccounts: number): ExcelRecord[];
  createExistingClassifications(manualCount: number): Map<string, ClassificationInfo>;
  createConflictScenario(type: 'heavy_conflicts' | 'light_conflicts' | 'no_conflicts'): TestScenario;
}
```

### 持续集成验证
- 每次提交自动运行单元测试和集成测试
- 每日运行完整的E2E测试套件
- 性能回归测试：对比基准性能指标
- 数据安全验证：确保测试不影响生产数据
