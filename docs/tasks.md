# TikTok数据上传系统 - Task List

## Implementation Tasks

- [ ] 1. **项目初始化和环境配置**
    - [ ] 1.1. Next.js项目初始化
        - *Goal*: 创建Next.js 14项目基础结构
        - *Details*: 使用TypeScript，配置Tailwind CSS，设置基本项目结构
        - *Requirements*: 技术栈要求 - Next.js + TypeScript
    - [ ] 1.2. 安装核心依赖
        - *Goal*: 安装Excel处理和数据库相关依赖
        - *Details*: xlsx库用于Excel解析，pg库用于PostgreSQL连接，其他必要依赖
        - *Requirements*: 支持Excel文件解析和数据库操作
    - [ ] 1.3. 数据库连接配置
        - *Goal*: 配置PostgreSQL数据库连接
        - *Details*: 使用现有DATABASE_URL，创建连接池，测试连接
        - *Requirements*: 连接现有tiktok_videos_raw表

- [ ] 2. **核心数据处理功能**
    - [ ] 2.1. Excel解析器开发
        - *Goal*: 实现Excel文件读取和数据解析功能
        - *Details*: 使用xlsx库解析.xlsx和.xls文件，支持中英文列名识别
        - *Requirements*: 支持.xlsx和.xls格式，文件大小限制50MB
    - [ ] 2.2. 数据映射和转换器
        - *Goal*: 实现字段映射和数据类型转换
        - *Details*: 根据已提供的normalizeRawData函数，支持34个字段映射
        - *Requirements*: 中英文列名自动匹配，智能数据类型转换
    - [ ] 2.3. 分批数据库插入功能
        - *Goal*: 实现大量数据的分批插入处理
        - *Details*: 500行/批处理，事务管理，错误时回滚机制
        - *Requirements*: 支持几千行数据处理，允许重复work_id

- [ ] 3. **文件上传API开发**
    - [ ] 3.1. 上传API路由实现
        - *Goal*: 创建/api/upload端点处理文件上传
        - *Details*: 处理FormData，文件验证，调用数据处理流程
        - *Requirements*: 文件格式和大小验证，错误处理
    - [ ] 3.2. 实时进度反馈机制
        - *Goal*: 实现上传进度的实时更新
        - *Details*: 使用Server-Sent Events或简化的轮询机制
        - *Requirements*: 实时显示上传进度百分比
    - [ ] 3.3. 错误处理和响应
        - *Goal*: 统一的错误处理和用户友好的错误消息
        - *Details*: 错误分类，详细错误信息，立即停止机制
        - *Requirements*: 遇错立即停止，详细错误反馈

- [ ] 4. **前端用户界面开发**
    - [ ] 4.1. 文件上传组件
        - *Goal*: 创建文件选择和上传界面组件
        - *Details*: 拖拽上传支持，文件格式验证，上传按钮状态管理
        - *Requirements*: 支持Excel文件选择，格式限制提示
    - [ ] 4.2. 进度显示组件
        - *Goal*: 实现上传进度条和状态显示
        - *Details*: 实时进度更新，处理状态指示，时间估算
        - *Requirements*: 实时进度百分比，处理状态反馈
    - [ ] 4.3. 结果展示组件
        - *Goal*: 显示处理结果和统计信息
        - *Details*: 成功插入行数，处理耗时，错误信息展示
        - *Requirements*: 成功行数统计，处理时间显示
    - [ ] 4.4. 主页面整合
        - *Goal*: 整合所有组件到主上传页面
        - *Details*: 页面布局，状态管理，组件间通信
        - *Requirements*: 简洁易用的界面，清晰的操作流程

- [ ] 5. **数据类型和配置**
    - [ ] 5.1. TypeScript类型定义
        - *Goal*: 定义所有数据结构的TypeScript类型
        - *Details*: TiktokRawData接口，API响应类型，组件Props类型
        - *Requirements*: 类型安全，代码智能提示
    - [ ] 5.2. 字段映射配置文件
        - *Goal*: 创建可配置的字段映射规则
        - *Details*: 基于现有normalizeRawData逻辑，支持扩展和修改
        - *Requirements*: 34个字段完整映射，中英文支持

## Task Dependencies

### 关键路径
- **Task 1** 必须首先完成：项目基础和环境是所有后续开发的前提
- **Task 2.1, 2.2** 可以并行开发：Excel解析和数据映射相对独立
- **Task 2.3** 依赖于 Task 2.2：分批插入需要数据映射功能
- **Task 3.1** 依赖于 Task 2 全部完成：API需要调用所有数据处理功能
- **Task 3.2, 3.3** 依赖于 Task 3.1：进度反馈和错误处理建立在基础API之上
- **Task 4** 可以与 Task 3 部分并行：前端组件开发可以先基于API设计进行
- **Task 5.1** 应该在项目初期完成：类型定义有助于开发过程中的类型检查
- **Task 5.2** 依赖于 Task 2.2：字段映射配置基于数据转换逻辑

### 并行开发建议
- Phase 1: Task 1 + Task 5.1 (项目初始化 + 类型定义)
- Phase 2: Task 2.1, 2.2 并行 (Excel解析 + 数据映射)
- Phase 3: Task 2.3 + Task 4.1 并行 (分批插入 + 前端上传组件)
- Phase 4: Task 3 全部 (API开发)
- Phase 5: Task 4.2-4.4 + Task 5.2 (前端完善 + 配置优化)

## Estimated Timeline

### 详细时间估算

**Task 1: 项目初始化和环境配置** - 4小时
- 1.1 Next.js项目初始化: 1小时
- 1.2 安装核心依赖: 1小时
- 1.3 数据库连接配置: 2小时

**Task 2: 核心数据处理功能** - 12小时
- 2.1 Excel解析器开发: 4小时
- 2.2 数据映射和转换器: 5小时
- 2.3 分批数据库插入功能: 3小时

**Task 3: 文件上传API开发** - 8小时
- 3.1 上传API路由实现: 3小时
- 3.2 实时进度反馈机制: 3小时
- 3.3 错误处理和响应: 2小时

**Task 4: 前端用户界面开发** - 10小时
- 4.1 文件上传组件: 2小时
- 4.2 进度显示组件: 2小时
- 4.3 结果展示组件: 2小时
- 4.4 主页面整合: 4小时

**Task 5: 数据类型和配置** - 3小时
- 5.1 TypeScript类型定义: 2小时
- 5.2 字段映射配置文件: 1小时

### 阶段性交付
- **Phase 1** (5小时): 基础项目搭建和类型定义
- **Phase 2** (12小时): 核心数据处理功能完成
- **Phase 3** (15小时): API和基础前端组件完成
- **Phase 4** (22小时): 完整功能集成测试
- **Phase 5** (25小时): 优化和验收测试

**总计: 37小时**

### 关键里程碑
- 🎯 **Day 1**: 项目初始化完成，可以运行基础Next.js应用
- 🎯 **Day 2**: Excel解析和数据映射功能完成，可以处理测试文件
- 🎯 **Day 3**: API开发完成，可以通过接口上传和处理数据
- 🎯 **Day 4**: 前端界面完成，具备完整的用户交互能力
- 🎯 **Day 5**: 系统集成测试，满足所有验收标准