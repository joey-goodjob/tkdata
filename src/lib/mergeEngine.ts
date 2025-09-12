import { db } from './database';
import { TiktokRawData } from './database';

// 合并策略枚举
export enum MergeStrategy {
  PROTECT = 'protect',    // 保护现有分类
  OVERWRITE = 'overwrite', // 覆盖现有分类
  INTERACTIVE = 'interactive' // 交互式选择
}

// 冲突类型枚举
export enum ConflictType {
  STATUS_MISMATCH = 'status_mismatch',      // 状态不匹配
  EXCEL_EMPTY = 'excel_empty',              // Excel中状态为空
  DB_EMPTY = 'db_empty',                    // 数据库中状态为空
  BOTH_HAVE_VALUE = 'both_have_value'       // 双方都有值但不同
}

// 冲突信息接口
export interface ConflictInfo {
  author: string;
  conflictType: ConflictType;
  dbValue: string | null;
  excelValue: string | null;
  recommendation: 'keep_db' | 'use_excel' | 'manual_review';
  reason: string;
}

// 合并预览结果接口
export interface MergePreview {
  totalRecords: number;
  conflictCount: number;
  newAccountCount: number;
  protectedCount: number;
  updateCount: number;
  conflicts: ConflictInfo[];
  summary: {
    willBeProtected: number;
    willBeUpdated: number;
    needsManualReview: number;
  };
}

// 合并执行结果接口
export interface MergeExecutionResult {
  operationId: string;
  success: boolean;
  processedAccounts: number;
  updatedAccounts: number;
  protectedAccounts: number;
  newAccounts: number;
  conflictsResolved: number;
  errors: string[];
  executionTimeMs: number;
  rollbackData: any;
}

// 冲突解决方案接口（用于交互式模式）
export interface ConflictResolution {
  author: string;
  action: 'keep_db' | 'use_excel' | 'skip';
  newValue?: string;
}

// 合并选项接口
export interface MergeOptions {
  strategy: MergeStrategy;
  userId?: string;
  conflictResolutions?: ConflictResolution[]; // 仅在交互模式下使用
  dryRun?: boolean; // 是否为演示模式
}

/**
 * 智能数据合并引擎
 * 支持三种合并策略，确保用户手动分类不被意外覆盖
 */
export class MergeEngine {
  
  /**
   * 生成合并预览
   * 分析Excel数据与现有数据的冲突，不执行实际合并
   */
  async generatePreview(
    excelData: TiktokRawData[], 
    strategy: MergeStrategy = MergeStrategy.PROTECT
  ): Promise<MergePreview> {
    try {
      const conflicts: ConflictInfo[] = [];
      let newAccountCount = 0;
      let protectedCount = 0;
      let updateCount = 0;

      // 获取Excel中涉及的账号列表
      const excelAuthors = Array.from(new Set(
        excelData
          .map(record => record.author)
          .filter(author => author && author.trim())
      ));

      if (excelAuthors.length === 0) {
        return {
          totalRecords: excelData.length,
          conflictCount: 0,
          newAccountCount: 0,
          protectedCount: 0,
          updateCount: 0,
          conflicts: [],
          summary: {
            willBeProtected: 0,
            willBeUpdated: 0,
            needsManualReview: 0
          }
        };
      }

      // 批量查询现有数据中这些账号的状态
      const placeholders = excelAuthors.map((_, i) => `$${i + 1}`).join(',');
      const existingAccountsResult = await db.query(`
        SELECT 
          author,
          author_status,
          manual_classified,
          classification_source,
          classification_time,
          COUNT(*) as works_count
        FROM tiktok_videos_raw 
        WHERE author IN (${placeholders})
        GROUP BY author, author_status, manual_classified, classification_source, classification_time
      `, excelAuthors);

      // 构建现有账号状态映射
      const existingAccounts = new Map<string, {
        author_status: string | null;
        manual_classified: boolean;
        classification_source: string | null;
        classification_time: Date | null;
        works_count: number;
      }>();

      existingAccountsResult.rows.forEach(row => {
        existingAccounts.set(row.author, {
          author_status: row.author_status,
          manual_classified: row.manual_classified || false,
          classification_source: row.classification_source,
          classification_time: row.classification_time,
          works_count: parseInt(row.works_count)
        });
      });

      // 构建Excel账号状态映射（取每个账号的最常见状态）
      const excelAccountStatus = new Map<string, string>();
      excelData.forEach(record => {
        if (record.author && record.author_status) {
          const author = record.author.trim();
          const status = record.author_status.trim();
          
          if (status && (status === '成品号' || status === '半成品号')) {
            excelAccountStatus.set(author, status);
          }
        }
      });

      // 分析每个账号的冲突情况
      for (const author of excelAuthors) {
        const existingData = existingAccounts.get(author);
        const excelStatus = excelAccountStatus.get(author);

        if (!existingData) {
          // 新账号
          newAccountCount++;
          updateCount++;
        } else {
          const dbStatus = existingData.author_status;
          const isManuallyClassified = existingData.manual_classified;
          
          // 分析冲突类型和推荐策略
          const conflictInfo = this.analyzeConflict(
            author, 
            dbStatus, 
            excelStatus, 
            isManuallyClassified,
            strategy
          );

          if (conflictInfo) {
            conflicts.push(conflictInfo);
            
            if (conflictInfo.recommendation === 'keep_db') {
              protectedCount++;
            } else if (conflictInfo.recommendation === 'use_excel') {
              updateCount++;
            }
          } else {
            // 没有冲突，根据策略决定更新或保护
            if (strategy === MergeStrategy.PROTECT && isManuallyClassified) {
              protectedCount++;
            } else if (excelStatus && excelStatus !== dbStatus) {
              updateCount++;
            }
          }
        }
      }

      return {
        totalRecords: excelData.length,
        conflictCount: conflicts.length,
        newAccountCount,
        protectedCount,
        updateCount,
        conflicts,
        summary: {
          willBeProtected: protectedCount,
          willBeUpdated: updateCount,
          needsManualReview: conflicts.filter(c => c.recommendation === 'manual_review').length
        }
      };

    } catch (error) {
      console.error('生成合并预览失败:', error);
      throw new Error(`合并预览生成失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行数据合并
   */
  async executeMerge(
    excelData: TiktokRawData[],
    options: MergeOptions
  ): Promise<MergeExecutionResult> {
    const startTime = Date.now();
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN'); // 开始事务

      // 创建操作记录
      const operationResult = await client.query(`
        INSERT INTO merge_operations (
          strategy, user_id, operation_summary, status
        ) VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [
        options.strategy,
        options.userId || 'system',
        `执行${options.strategy}策略合并，涉及${excelData.length}条记录`,
        'in_progress'
      ]);

      const operationId = operationResult.rows[0].id;
      const rollbackData: any = { affectedAccounts: [], originalStates: [] };
      
      let processedAccounts = 0;
      let updatedAccounts = 0;
      let protectedAccounts = 0;
      let newAccounts = 0;
      let conflictsResolved = 0;
      const errors: string[] = [];

      // 如果是演示模式，跳过实际执行
      if (options.dryRun) {
        const preview = await this.generatePreview(excelData, options.strategy);
        await client.query('ROLLBACK');
        return {
          operationId,
          success: true,
          processedAccounts: preview.totalRecords,
          updatedAccounts: preview.updateCount,
          protectedAccounts: preview.protectedCount,
          newAccounts: preview.newAccountCount,
          conflictsResolved: preview.conflictCount,
          errors: [],
          executionTimeMs: Date.now() - startTime,
          rollbackData: {}
        };
      }

      // 根据策略执行合并
      switch (options.strategy) {
        case MergeStrategy.PROTECT:
          const protectResult = await this.executeProtectStrategy(
            client, excelData, operationId, rollbackData
          );
          processedAccounts = protectResult.processed;
          updatedAccounts = protectResult.updated;
          protectedAccounts = protectResult.protected;
          newAccounts = protectResult.newAccounts;
          errors.push(...protectResult.errors);
          break;

        case MergeStrategy.OVERWRITE:
          const overwriteResult = await this.executeOverwriteStrategy(
            client, excelData, operationId, rollbackData
          );
          processedAccounts = overwriteResult.processed;
          updatedAccounts = overwriteResult.updated;
          newAccounts = overwriteResult.newAccounts;
          errors.push(...overwriteResult.errors);
          break;

        case MergeStrategy.INTERACTIVE:
          if (!options.conflictResolutions) {
            throw new Error('交互式模式需要提供冲突解决方案');
          }
          const interactiveResult = await this.executeInteractiveStrategy(
            client, excelData, options.conflictResolutions, operationId, rollbackData
          );
          processedAccounts = interactiveResult.processed;
          updatedAccounts = interactiveResult.updated;
          protectedAccounts = interactiveResult.protected;
          newAccounts = interactiveResult.newAccounts;
          conflictsResolved = interactiveResult.conflictsResolved;
          errors.push(...interactiveResult.errors);
          break;
      }

      // 更新操作记录
      const executionTime = Date.now() - startTime;
      await client.query(`
        UPDATE merge_operations 
        SET 
          status = $1,
          conflict_count = $2,
          affected_account_count = $3,
          rollback_data = $4,
          execution_time_ms = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
      `, [
        errors.length > 0 ? 'completed_with_errors' : 'completed',
        conflictsResolved,
        processedAccounts,
        JSON.stringify(rollbackData),
        executionTime,
        operationId
      ]);

      await client.query('COMMIT'); // 提交事务

      return {
        operationId,
        success: errors.length === 0,
        processedAccounts,
        updatedAccounts,
        protectedAccounts,
        newAccounts,
        conflictsResolved,
        errors,
        executionTimeMs: executionTime,
        rollbackData
      };

    } catch (error) {
      await client.query('ROLLBACK'); // 回滚事务
      console.error('合并执行失败:', error);
      throw new Error(`合并执行失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }

  /**
   * 分析单个账号的冲突情况
   */
  private analyzeConflict(
    author: string,
    dbStatus: string | null,
    excelStatus: string | undefined,
    isManuallyClassified: boolean,
    strategy: MergeStrategy
  ): ConflictInfo | null {
    
    // 标准化状态值
    const normalizedDbStatus = dbStatus?.trim() || null;
    const normalizedExcelStatus = excelStatus?.trim() || null;
    
    // 如果两者相同，无冲突
    if (normalizedDbStatus === normalizedExcelStatus) {
      return null;
    }

    let conflictType: ConflictType;
    let recommendation: 'keep_db' | 'use_excel' | 'manual_review';
    let reason: string;

    // 分析冲突类型
    if (!normalizedDbStatus && normalizedExcelStatus) {
      conflictType = ConflictType.DB_EMPTY;
      recommendation = 'use_excel';
      reason = '数据库中无状态，使用Excel中的分类';
    } else if (normalizedDbStatus && !normalizedExcelStatus) {
      conflictType = ConflictType.EXCEL_EMPTY;
      recommendation = 'keep_db';
      reason = 'Excel中无状态，保持数据库中的分类';
    } else if (normalizedDbStatus && normalizedExcelStatus) {
      conflictType = ConflictType.BOTH_HAVE_VALUE;
      
      if (isManuallyClassified && strategy === MergeStrategy.PROTECT) {
        recommendation = 'keep_db';
        reason = '用户手动分类，执行保护策略';
      } else if (strategy === MergeStrategy.OVERWRITE) {
        recommendation = 'use_excel';
        reason = '执行覆盖策略，使用Excel中的分类';
      } else {
        recommendation = 'manual_review';
        reason = '双方都有不同值，建议手动审核';
      }
    } else {
      conflictType = ConflictType.STATUS_MISMATCH;
      recommendation = 'manual_review';
      reason = '状态值异常，需要手动审核';
    }

    return {
      author,
      conflictType,
      dbValue: normalizedDbStatus,
      excelValue: normalizedExcelStatus,
      recommendation,
      reason
    };
  }

  /**
   * 执行保护策略
   * 优先保护现有的手动分类，只更新新账号和无分类的账号
   */
  private async executeProtectStrategy(
    client: any,
    excelData: TiktokRawData[],
    operationId: string,
    rollbackData: any
  ): Promise<{
    processed: number;
    updated: number;
    protected: number;
    newAccounts: number;
    errors: string[];
  }> {
    let processed = 0;
    let updated = 0;
    let protectedCount = 0;
    let newAccounts = 0;
    const errors: string[] = [];

    try {
      // 构建账号状态映射
      const accountStatusMap = new Map<string, string>();
      excelData.forEach(record => {
        if (record.author && record.author_status) {
          const author = record.author.trim();
          const status = record.author_status.trim();
          if (status === '成品号' || status === '半成品号') {
            accountStatusMap.set(author, status);
          }
        }
      });

      for (const [author, newStatus] of accountStatusMap) {
        try {
          processed++;

          // 检查账号是否存在及其分类状态
          const existingResult = await client.query(`
            SELECT 
              author_status,
              manual_classified,
              classification_source
            FROM tiktok_videos_raw 
            WHERE author = $1 
            LIMIT 1
          `, [author]);

          if (existingResult.rows.length === 0) {
            // 新账号，直接更新
            await this.updateAccountStatus(
              client, author, null, newStatus, 'import', operationId, rollbackData
            );
            newAccounts++;
            updated++;
          } else {
            const existing = existingResult.rows[0];
            const isManuallyClassified = existing.manual_classified;
            const currentStatus = existing.author_status;

            if (isManuallyClassified && currentStatus) {
              // 手动分类账号，执行保护
              protectedCount++;
              
              // 记录保护操作到审计表
              await client.query(`
                INSERT INTO classification_audit (
                  author, old_status, new_status, classification_source,
                  operation_id, additional_data
                ) VALUES ($1, $2, $3, $4, $5, $6)
              `, [
                author, currentStatus, currentStatus, 'protect',
                operationId, JSON.stringify({
                  action: 'protected',
                  reason: '保护现有手动分类',
                  attempted_new_status: newStatus
                })
              ]);
            } else if (!currentStatus || currentStatus !== newStatus) {
              // 无分类或分类不同且非手动分类，可以更新
              await this.updateAccountStatus(
                client, author, currentStatus, newStatus, 'import', operationId, rollbackData
              );
              updated++;
            }
          }

        } catch (error) {
          errors.push(`处理账号 ${author} 失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

    } catch (error) {
      errors.push(`保护策略执行失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { processed, updated, protected: protectedCount, newAccounts, errors };
  }

  /**
   * 执行覆盖策略
   * 强制覆盖所有现有分类（谨慎使用）
   */
  private async executeOverwriteStrategy(
    client: any,
    excelData: TiktokRawData[],
    operationId: string,
    rollbackData: any
  ): Promise<{
    processed: number;
    updated: number;
    newAccounts: number;
    errors: string[];
  }> {
    let processed = 0;
    let updated = 0;
    let newAccounts = 0;
    const errors: string[] = [];

    try {
      // 构建账号状态映射
      const accountStatusMap = new Map<string, string>();
      excelData.forEach(record => {
        if (record.author && record.author_status) {
          const author = record.author.trim();
          const status = record.author_status.trim();
          if (status === '成品号' || status === '半成品号') {
            accountStatusMap.set(author, status);
          }
        }
      });

      for (const [author, newStatus] of accountStatusMap) {
        try {
          processed++;

          // 检查账号是否存在
          const existingResult = await client.query(`
            SELECT author_status FROM tiktok_videos_raw 
            WHERE author = $1 LIMIT 1
          `, [author]);

          if (existingResult.rows.length === 0) {
            newAccounts++;
          }

          const currentStatus = existingResult.rows[0]?.author_status || null;
          
          // 强制更新状态
          await this.updateAccountStatus(
            client, author, currentStatus, newStatus, 'import', operationId, rollbackData
          );
          updated++;

        } catch (error) {
          errors.push(`处理账号 ${author} 失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

    } catch (error) {
      errors.push(`覆盖策略执行失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { processed, updated, newAccounts, errors };
  }

  /**
   * 执行交互式策略
   * 根据用户提供的冲突解决方案执行合并
   */
  private async executeInteractiveStrategy(
    client: any,
    excelData: TiktokRawData[],
    resolutions: ConflictResolution[],
    operationId: string,
    rollbackData: any
  ): Promise<{
    processed: number;
    updated: number;
    protected: number;
    newAccounts: number;
    conflictsResolved: number;
    errors: string[];
  }> {
    let processed = 0;
    let updated = 0;
    let protectedCount = 0;
    let newAccounts = 0;
    let conflictsResolved = 0;
    const errors: string[] = [];

    try {
      // 构建解决方案映射
      const resolutionMap = new Map<string, ConflictResolution>();
      resolutions.forEach(resolution => {
        resolutionMap.set(resolution.author, resolution);
      });

      // 构建Excel账号状态映射
      const excelStatusMap = new Map<string, string>();
      excelData.forEach(record => {
        if (record.author && record.author_status) {
          const author = record.author.trim();
          const status = record.author_status.trim();
          if (status === '成品号' || status === '半成品号') {
            excelStatusMap.set(author, status);
          }
        }
      });

      for (const [author, excelStatus] of excelStatusMap) {
        try {
          processed++;
          const resolution = resolutionMap.get(author);

          // 检查账号现状
          const existingResult = await client.query(`
            SELECT author_status FROM tiktok_videos_raw 
            WHERE author = $1 LIMIT 1
          `, [author]);

          const currentStatus = existingResult.rows.length > 0 
            ? existingResult.rows[0].author_status 
            : null;

          if (!currentStatus) {
            newAccounts++;
          }

          if (!resolution) {
            // 无解决方案，使用默认行为（保护）
            if (currentStatus) {
              protectedCount++;
            } else {
              await this.updateAccountStatus(
                client, author, null, excelStatus, 'import', operationId, rollbackData
              );
              updated++;
            }
            continue;
          }

          conflictsResolved++;

          // 根据解决方案执行操作
          switch (resolution.action) {
            case 'keep_db':
              protectedCount++;
              await client.query(`
                INSERT INTO classification_audit (
                  author, old_status, new_status, classification_source,
                  operation_id, additional_data
                ) VALUES ($1, $2, $3, $4, $5, $6)
              `, [
                author, currentStatus, currentStatus, 'manual',
                operationId, JSON.stringify({
                  action: 'user_choice_keep',
                  reason: '用户选择保持现有状态'
                })
              ]);
              break;

            case 'use_excel':
              await this.updateAccountStatus(
                client, author, currentStatus, excelStatus, 'manual', operationId, rollbackData
              );
              updated++;
              break;

            case 'skip':
              // 跳过处理
              break;
          }

        } catch (error) {
          errors.push(`处理账号 ${author} 失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

    } catch (error) {
      errors.push(`交互式策略执行失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { processed, updated, protected: protectedCount, newAccounts, conflictsResolved, errors };
  }

  /**
   * 更新账号状态的通用方法
   */
  private async updateAccountStatus(
    client: any,
    author: string,
    oldStatus: string | null,
    newStatus: string,
    source: string,
    operationId: string,
    rollbackData: any
  ): Promise<void> {
    // 记录回滚数据
    rollbackData.affectedAccounts.push(author);
    rollbackData.originalStates.push({
      author,
      old_status: oldStatus
    });

    // 更新所有该账号的记录
    await client.query(`
      UPDATE tiktok_videos_raw 
      SET 
        author_status = $1,
        classification_source = $2,
        classification_time = CURRENT_TIMESTAMP,
        manual_classified = $3,
        last_import_time = CURRENT_TIMESTAMP
      WHERE author = $4
    `, [newStatus, source, source === 'manual', author]);

    // 记录变更到审计表
    await client.query(`
      INSERT INTO classification_audit (
        author, old_status, new_status, classification_source,
        operation_id, additional_data
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      author, oldStatus, newStatus, source,
      operationId, JSON.stringify({
        action: 'status_update',
        timestamp: new Date().toISOString()
      })
    ]);
  }
}

// 导出单例实例
export const mergeEngine = new MergeEngine();