# 智能保护用户标记的数据合并系统 - Task List

## Implementation Tasks

- [x] 1. **数据库架构升级与索引优化**
    - [x] 1.1. 扩展tiktok_videos_raw表字段
        - *Goal*: 添加数据溯源追踪字段，支持分类来源识别
        - *Details*: 添加classification_source, classification_time, last_import_time, manual_classified字段，设置合适的默认值和数据类型
        - *Requirements*: 数据溯源追踪验收标准、来源标记、时间追踪
    - [x] 1.2. 创建merge_operations审计表
        - *Goal*: 建立合并操作记录表，支持操作历史查询和回滚
        - *Details*: 设计UUID主键、JSON回滚数据存储、完整的操作元数据字段
        - *Requirements*: 操作日志、审计追踪验收标准
    - [x] 1.3. 创建classification_audit历史表
        - *Goal*: 记录每次分类变更的详细历史，支持变更追踪
        - *Details*: 记录老状态、新状态、变更来源、关联操作ID等信息
        - *Requirements*: 审计追踪验收标准、时间追踪
    - [x] 1.4. 创建性能优化索引
        - *Goal*: 优化冲突检测和审计查询性能
        - *Details*: 在author+classification_source、timestamp等字段建立组合索引
        - *Requirements*: 性能要求（冲突检测不超过现有时间150%）

- [x] 2. **核心业务逻辑服务实现**
    - [x] 2.1. ConflictDetector冲突检测器
        - *Goal*: 实现智能冲突检测，识别Excel与现有分类的冲突
        - *Details*: 实现detectConflicts方法，支持多种冲突类型识别（状态不匹配、Excel空值、双方有值），生成详细的冲突分析报告
        - *Requirements*: 冲突检测、默认保护、策略选择验收标准
    - [x] 2.2. MergeEngine合并引擎
        - *Goal*: 实现三种合并策略的执行引擎
        - *Details*: 支持保护模式、覆盖模式、交互模式，提供合并预览功能，确保数据完整性和事务性
        - *Requirements*: 分类保护、统计更新、新账号处理验收标准
    - [x] 2.3. AuditService审计服务
        - *Goal*: 提供完整的审计追踪和操作历史管理
        - *Details*: 记录合并操作、分类变更历史、支持操作查询和回滚功能
        - *Requirements*: 操作日志、审计追踪验收标准
    - [x] 2.4. BackupService备份服务
        - *Goal*: 实现操作前数据备份和错误恢复机制
        - *Details*: 创建操作前快照、支持选择性数据恢复、备份数据过期管理
        - *Requirements*: 数据完整性验收标准、错误恢复

- [ ] 3. **API接口层开发**
    - [x] 3.1. 冲突检测API端点
        - *Goal*: 提供Excel数据预处理和冲突分析接口
        - *Details*: POST /api/upload/analyze - 接收Excel数据，返回冲突分析结果和摘要
        - *Requirements*: 冲突预览验收标准
    - [x] 3.2. 合并执行API端点
        - *Goal*: 执行实际的数据合并操作
        - *Details*: POST /api/upload/merge - 接收合并策略和冲突解决方案，执行合并并返回详细结果
        - *Requirements*: 操作确认、结果报告验收标准
    - [x] 3.3. 审计查询API端点
        - *Goal*: 提供操作历史查询和回滚功能
        - *Details*: GET /api/merge/history, POST /api/merge/rollback - 支持历史查询和操作撤销
        - *Requirements*: 审计追踪验收标准
    - [ ] 3.4. 增强现有上传API
        - *Goal*: 集成冲突检测到现有上传流程
        - *Details*: 修改现有/api/upload路由，增加冲突检测步骤和策略选择
        - *Requirements*: 向后兼容性要求、API兼容

- [ ] 4. **前端用户界面开发**
    - [x] 4.1. 冲突预览组件
        - *Goal*: 显示冲突摘要和详细冲突列表
        - *Details*: 实现ConflictSummary和ConflictDetailList组件，支持冲突类型分类显示
        - *Requirements*: 冲突预览验收标准
    - [x] 4.2. 策略选择界面
        - *Goal*: 提供直观的合并策略选择界面
        - *Details*: 实现MergeStrategySelector组件，支持三种策略选择和说明
        - *Requirements*: 操作确认验收标准
    - [ ] 4.3. 交互式冲突解决界面
        - *Goal*: 支持用户逐项决定冲突处理方式
        - *Details*: 实现InteractiveConflictResolver组件，支持批量操作和个别决策
        - *Requirements*: 用户体验验收标准、批量操作粒度
    - [ ] 4.4. 操作结果报告组件
        - *Goal*: 显示详细的合并结果和操作摘要
        - *Details*: 实现MergeResultReport组件，包含统计数据、影响账号、回滚选项
        - *Requirements*: 结果报告验收标准
    - [ ] 4.5. 操作历史管理界面
        - *Goal*: 提供操作历史查看和管理功能
        - *Details*: 实现OperationHistory组件，支持历史查询、详情查看、操作回滚
        - *Requirements*: 审计追踪验收标准

- [ ] 5. **数据处理与验证增强**
    - [x] 5.1. Excel数据解析增强
        - *Goal*: 增强Excel解析器，支持冲突检测所需的数据提取
        - *Details*: 扩展现有excelParser，提取账号状态信息、验证数据格式、处理重复账号
        - *Requirements*: 基础功能验收标准、数据完整性
    - [x] 5.2. 数据验证规则实现
        - *Goal*: 实现完整的数据验证和错误处理机制
        - *Details*: 添加Excel格式验证、必需列检查、状态值验证、重复检测
        - *Requirements*: 用户体验验收标准、错误处理
    - [ ] 5.3. 事务管理器实现
        - *Goal*: 确保合并操作的原子性和数据一致性
        - *Details*: 实现TransactionManager，支持操作回滚、数据完整性验证
        - *Requirements*: 数据完整性验收标准、安全性要求

- [ ] 6. **测试套件开发**
    - [x] 6.1. 单元测试实现
        - *Goal*: 为所有核心服务编写完整的单元测试
        - *Details*: 测试ConflictDetector、MergeEngine、AuditService等核心逻辑，覆盖边界条件和错误情况
        - *Requirements*: 测试策略覆盖率要求
    - [x] 6.2. 集成测试开发
        - *Goal*: 测试完整的工作流程和组件协作
        - *Details*: 测试上传→检测→合并的完整流程，验证数据库事务和API协作
        - *Requirements*: 基础功能验收标准、数据完整性验收标准
    - [ ] 6.3. 性能测试实现
        - *Goal*: 验证系统在大数据量下的性能表现
        - *Details*: 测试10,000条记录的冲突检测性能，1,000个冲突的合并性能
        - *Requirements*: 性能要求验收标准
    - [ ] 6.4. E2E用户流程测试
        - *Goal*: 模拟真实用户操作场景的端到端测试
        - *Details*: 使用Playwright测试完整的用户界面交互流程
        - *Requirements*: 用户体验验收标准

- [ ] 7. **部署与监控配置**
    - [x] 7.1. 数据库迁移脚本
        - *Goal*: 创建安全的数据库升级脚本
        - *Details*: 编写渐进式迁移脚本，支持回滚，确保现有数据不丢失
        - *Requirements*: 数据迁移要求、向后兼容性
    - [x] 7.2. 监控和日志配置
        - *Goal*: 添加操作监控和错误追踪
        - *Details*: 配置合并操作的监控指标、错误日志收集、性能监控
        - *Requirements*: 审计日志、安全性要求
    - [ ] 7.3. 文档和用户指南
        - *Goal*: 提供完整的使用文档和故障处理指南
        - *Details*: 编写用户操作指南、管理员手册、故障排除文档
        - *Requirements*: 用户体验验收标准

## Task Dependencies

- **Task 1（数据库）** 必须在所有其他任务之前完成
- **Task 2（核心服务）** 依赖Task 1完成，是其他任务的基础
- **Task 3（API）** 依赖Task 2完成，与Task 4可以并行开发
- **Task 4（前端界面）** 依赖Task 2和Task 3的API规范，可以在API开发过程中并行进行
- **Task 5（数据处理）** 可以与Task 2并行进行，但需要Task 1的数据结构支持
- **Task 6（测试）** 可以在各模块完成后逐步进行，单元测试可以与开发并行
- **Task 7（部署）** 依赖所有功能开发完成，在测试通过后进行

### 并行执行建议
- **Phase 1**: Task 1 → 完成数据库架构
- **Phase 2**: Task 2.1-2.2 + Task 5.1-5.2 并行 → 核心逻辑和数据处理
- **Phase 3**: Task 2.3-2.4 + Task 3.1-3.2 + Task 6.1 并行 → 审计功能、API和测试
- **Phase 4**: Task 3.3-3.4 + Task 4.1-4.3 + Task 6.2 并行 → 完整API和界面
- **Phase 5**: Task 4.4-4.5 + Task 6.3-6.4 并行 → 完善界面和测试
- **Phase 6**: Task 7 → 部署和文档

## Estimated Timeline

- **Task 1 (数据库架构)**: 6小时
    - 1.1 表字段扩展: 2小时
    - 1.2 审计表创建: 2小时  
    - 1.3 历史表创建: 1小时
    - 1.4 索引优化: 1小时

- **Task 2 (核心服务)**: 20小时
    - 2.1 冲突检测器: 6小时
    - 2.2 合并引擎: 8小时
    - 2.3 审计服务: 4小时
    - 2.4 备份服务: 2小时

- **Task 3 (API接口)**: 12小时
    - 3.1 冲突检测API: 3小时
    - 3.2 合并执行API: 4小时
    - 3.3 审计查询API: 3小时
    - 3.4 上传API增强: 2小时

- **Task 4 (前端界面)**: 18小时
    - 4.1 冲突预览组件: 4小时
    - 4.2 策略选择界面: 3小时
    - 4.3 交互解决界面: 6小时
    - 4.4 结果报告组件: 3小时
    - 4.5 操作历史界面: 2小时

- **Task 5 (数据处理)**: 8小时
    - 5.1 Excel解析增强: 3小时
    - 5.2 数据验证规则: 3小时
    - 5.3 事务管理器: 2小时

- **Task 6 (测试套件)**: 16小时
    - 6.1 单元测试: 8小时
    - 6.2 集成测试: 4小时
    - 6.3 性能测试: 2小时
    - 6.4 E2E测试: 2小时

- **Task 7 (部署配置)**: 6小时
    - 7.1 数据库迁移: 2小时
    - 7.2 监控配置: 2小时
    - 7.3 文档编写: 2小时

**总估时: 86小时 (约11个工作日)**

### 关键里程碑
- **里程碑1** (Day 3): 数据库架构和核心检测逻辑完成
- **里程碑2** (Day 6): 完整的服务层和基础API完成
- **里程碑3** (Day 9): 用户界面和完整功能完成
- **里程碑4** (Day 11): 测试通过，准备部署
