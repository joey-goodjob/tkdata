import { db } from './database';

// 合并操作记录接口
export interface MergeOperationRecord {
  id: string;
  timestamp: Date;
  strategy: string;
  user_id: string | null;
  conflict_count: number;
  affected_account_count: number;
  operation_summary: string | null;
  rollback_data: any;
  status: string;
  execution_time_ms: number | null;
  created_at: Date;
  updated_at: Date;
}

// 分类变更记录接口
export interface ClassificationAuditRecord {
  id: string;
  author: string;
  old_status: string | null;
  new_status: string | null;
  classification_source: string;
  operation_id: string | null;
  timestamp: Date;
  additional_data: any;
  created_at: Date;
}

// 查询选项接口
export interface AuditQueryOptions {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  strategy?: string;
  status?: string;
  author?: string;
  source?: string;
}

// 审计统计接口
export interface AuditStatistics {
  totalOperations: number;
  totalChanges: number;
  recentOperations: number; // 最近7天
  recentChanges: number; // 最近7天
  strategyDistribution: { [strategy: string]: number };
  sourceDistribution: { [source: string]: number };
  statusDistribution: { [status: string]: number };
  errorRate: number;
}

// 账号变更历史接口
export interface AccountChangeHistory {
  author: string;
  totalChanges: number;
  changes: ClassificationAuditRecord[];
  timeline: {
    date: string;
    changes: number;
  }[];
}

// 回滚结果接口
export interface RollbackResult {
  success: boolean;
  operationId: string;
  affectedAccounts: number;
  restoredStates: number;
  errors: string[];
  rollbackOperationId?: string;
}

/**
 * 审计服务类
 * 提供完整的审计追踪和操作历史管理功能
 */
export class AuditService {

  /**
   * 查询合并操作历史
   */
  async getMergeOperations(options: AuditQueryOptions = {}): Promise<{
    operations: MergeOperationRecord[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const {
        limit = 50,
        offset = 0,
        startDate,
        endDate,
        userId,
        strategy,
        status
      } = options;

      // 构建查询条件
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (startDate) {
        conditions.push(`timestamp >= $${paramIndex++}`);
        params.push(startDate);
      }

      if (endDate) {
        conditions.push(`timestamp <= $${paramIndex++}`);
        params.push(endDate);
      }

      if (userId) {
        conditions.push(`user_id = $${paramIndex++}`);
        params.push(userId);
      }

      if (strategy) {
        conditions.push(`strategy = $${paramIndex++}`);
        params.push(strategy);
      }

      if (status) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(status);
      }

      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      // 查询总数
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM merge_operations 
        ${whereClause}
      `;
      const countResult = await db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // 查询操作记录
      const dataQuery = `
        SELECT * FROM merge_operations 
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      const dataParams = [...params, limit, offset];
      const dataResult = await db.query(dataQuery, dataParams);

      const operations: MergeOperationRecord[] = dataResult.rows.map(row => ({
        ...row,
        rollback_data: row.rollback_data || {}
      }));

      return {
        operations,
        total,
        hasMore: offset + operations.length < total
      };

    } catch (error) {
      console.error('查询合并操作历史失败:', error);
      throw new Error(`查询合并操作历史失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 查询分类变更历史
   */
  async getClassificationChanges(options: AuditQueryOptions = {}): Promise<{
    changes: ClassificationAuditRecord[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const {
        limit = 100,
        offset = 0,
        startDate,
        endDate,
        author,
        source
      } = options;

      // 构建查询条件
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (startDate) {
        conditions.push(`timestamp >= $${paramIndex++}`);
        params.push(startDate);
      }

      if (endDate) {
        conditions.push(`timestamp <= $${paramIndex++}`);
        params.push(endDate);
      }

      if (author) {
        conditions.push(`author = $${paramIndex++}`);
        params.push(author);
      }

      if (source) {
        conditions.push(`classification_source = $${paramIndex++}`);
        params.push(source);
      }

      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      // 查询总数
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM classification_audit 
        ${whereClause}
      `;
      const countResult = await db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // 查询变更记录
      const dataQuery = `
        SELECT * FROM classification_audit 
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      const dataParams = [...params, limit, offset];
      const dataResult = await db.query(dataQuery, dataParams);

      const changes: ClassificationAuditRecord[] = dataResult.rows.map(row => ({
        ...row,
        additional_data: row.additional_data || {}
      }));

      return {
        changes,
        total,
        hasMore: offset + changes.length < total
      };

    } catch (error) {
      console.error('查询分类变更历史失败:', error);
      throw new Error(`查询分类变更历史失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 根据操作ID获取详细信息
   */
  async getOperationDetails(operationId: string): Promise<{
    operation: MergeOperationRecord | null;
    relatedChanges: ClassificationAuditRecord[];
  }> {
    try {
      // 查询操作记录
      const operationResult = await db.query(`
        SELECT * FROM merge_operations WHERE id = $1
      `, [operationId]);

      if (operationResult.rows.length === 0) {
        return { operation: null, relatedChanges: [] };
      }

      const operation: MergeOperationRecord = {
        ...operationResult.rows[0],
        rollback_data: operationResult.rows[0].rollback_data || {}
      };

      // 查询相关的分类变更记录
      const changesResult = await db.query(`
        SELECT * FROM classification_audit 
        WHERE operation_id = $1 
        ORDER BY timestamp ASC
      `, [operationId]);

      const relatedChanges: ClassificationAuditRecord[] = changesResult.rows.map(row => ({
        ...row,
        additional_data: row.additional_data || {}
      }));

      return { operation, relatedChanges };

    } catch (error) {
      console.error('获取操作详细信息失败:', error);
      throw new Error(`获取操作详细信息失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取账号变更历史
   */
  async getAccountChangeHistory(author: string, limit: number = 50): Promise<AccountChangeHistory> {
    try {
      // 查询账号的所有变更记录
      const changesResult = await db.query(`
        SELECT * FROM classification_audit 
        WHERE author = $1 
        ORDER BY timestamp DESC
        LIMIT $2
      `, [author, limit]);

      const changes: ClassificationAuditRecord[] = changesResult.rows.map(row => ({
        ...row,
        additional_data: row.additional_data || {}
      }));

      // 生成时间线统计
      const timelineMap = new Map<string, number>();
      changes.forEach(change => {
        const date = change.timestamp.toISOString().split('T')[0];
        timelineMap.set(date, (timelineMap.get(date) || 0) + 1);
      });

      const timeline = Array.from(timelineMap.entries())
        .map(([date, count]) => ({ date, changes: count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        author,
        totalChanges: changes.length,
        changes,
        timeline
      };

    } catch (error) {
      console.error('获取账号变更历史失败:', error);
      throw new Error(`获取账号变更历史失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取审计统计信息
   */
  async getAuditStatistics(): Promise<AuditStatistics> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // 并行执行多个统计查询
      const [
        totalOperationsResult,
        totalChangesResult,
        recentOperationsResult,
        recentChangesResult,
        strategyDistributionResult,
        sourceDistributionResult,
        statusDistributionResult,
        errorRateResult
      ] = await Promise.all([
        // 总操作数
        db.query('SELECT COUNT(*) as count FROM merge_operations'),
        // 总变更数
        db.query('SELECT COUNT(*) as count FROM classification_audit'),
        // 最近7天操作数
        db.query('SELECT COUNT(*) as count FROM merge_operations WHERE timestamp >= $1', [sevenDaysAgo]),
        // 最近7天变更数
        db.query('SELECT COUNT(*) as count FROM classification_audit WHERE timestamp >= $1', [sevenDaysAgo]),
        // 策略分布
        db.query(`
          SELECT strategy, COUNT(*) as count 
          FROM merge_operations 
          GROUP BY strategy 
          ORDER BY count DESC
        `),
        // 来源分布
        db.query(`
          SELECT classification_source, COUNT(*) as count 
          FROM classification_audit 
          GROUP BY classification_source 
          ORDER BY count DESC
        `),
        // 状态分布
        db.query(`
          SELECT status, COUNT(*) as count 
          FROM merge_operations 
          GROUP BY status 
          ORDER BY count DESC
        `),
        // 错误率
        db.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN status LIKE '%error%' OR status = 'failed' THEN 1 END) as errors
          FROM merge_operations
        `)
      ]);

      // 构建统计结果
      const strategyDistribution: { [key: string]: number } = {};
      strategyDistributionResult.rows.forEach(row => {
        strategyDistribution[row.strategy] = parseInt(row.count);
      });

      const sourceDistribution: { [key: string]: number } = {};
      sourceDistributionResult.rows.forEach(row => {
        sourceDistribution[row.classification_source] = parseInt(row.count);
      });

      const statusDistribution: { [key: string]: number } = {};
      statusDistributionResult.rows.forEach(row => {
        statusDistribution[row.status] = parseInt(row.count);
      });

      const errorRateData = errorRateResult.rows[0];
      const errorRate = errorRateData.total > 0 
        ? (parseFloat(errorRateData.errors) / parseFloat(errorRateData.total)) * 100
        : 0;

      return {
        totalOperations: parseInt(totalOperationsResult.rows[0].count),
        totalChanges: parseInt(totalChangesResult.rows[0].count),
        recentOperations: parseInt(recentOperationsResult.rows[0].count),
        recentChanges: parseInt(recentChangesResult.rows[0].count),
        strategyDistribution,
        sourceDistribution,
        statusDistribution,
        errorRate: Math.round(errorRate * 100) / 100
      };

    } catch (error) {
      console.error('获取审计统计信息失败:', error);
      throw new Error(`获取审计统计信息失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 回滚操作
   */
  async rollbackOperation(operationId: string, userId: string = 'system'): Promise<RollbackResult> {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN'); // 开始事务

      // 获取要回滚的操作详情
      const operationResult = await client.query(`
        SELECT * FROM merge_operations WHERE id = $1
      `, [operationId]);

      if (operationResult.rows.length === 0) {
        throw new Error(`操作 ${operationId} 不存在`);
      }

      const operation = operationResult.rows[0];
      const rollbackData = operation.rollback_data;

      if (!rollbackData || !rollbackData.affectedAccounts) {
        throw new Error('该操作没有回滚数据，无法回滚');
      }

      let affectedAccounts = 0;
      let restoredStates = 0;
      const errors: string[] = [];

      // 创建回滚操作记录
      const rollbackOperationResult = await client.query(`
        INSERT INTO merge_operations (
          strategy, user_id, operation_summary, status
        ) VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [
        'rollback',
        userId,
        `回滚操作 ${operationId}`,
        'in_progress'
      ]);
      
      const rollbackOperationId = rollbackOperationResult.rows[0].id;

      // 逐个恢复账号状态
      for (const stateInfo of rollbackData.originalStates || []) {
        try {
          const { author, old_status } = stateInfo;
          affectedAccounts++;

          // 恢复账号状态
          if (old_status === null) {
            // 原状态为空，清除状态
            await client.query(`
              UPDATE tiktok_videos_raw 
              SET 
                author_status = NULL,
                classification_source = NULL,
                classification_time = NULL,
                manual_classified = FALSE,
                last_import_time = CURRENT_TIMESTAMP
              WHERE author = $1
            `, [author]);
          } else {
            // 恢复到原状态
            await client.query(`
              UPDATE tiktok_videos_raw 
              SET 
                author_status = $1,
                classification_source = 'rollback',
                classification_time = CURRENT_TIMESTAMP,
                manual_classified = TRUE,
                last_import_time = CURRENT_TIMESTAMP
              WHERE author = $2
            `, [old_status, author]);
          }

          // 记录回滚变更
          await client.query(`
            INSERT INTO classification_audit (
              author, old_status, new_status, classification_source,
              operation_id, additional_data
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            author,
            null, // 当前状态，由于回滚时不确定，记录为null
            old_status,
            'rollback',
            rollbackOperationId,
            JSON.stringify({
              action: 'rollback',
              source_operation_id: operationId,
              timestamp: new Date().toISOString()
            })
          ]);

          restoredStates++;

        } catch (error) {
          errors.push(`恢复账号 ${stateInfo.author} 失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // 更新回滚操作状态
      await client.query(`
        UPDATE merge_operations 
        SET 
          status = $1,
          affected_account_count = $2,
          execution_time_ms = $3,
          rollback_data = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
      `, [
        errors.length > 0 ? 'completed_with_errors' : 'completed',
        affectedAccounts,
        0, // 回滚操作时间后续可以计算
        JSON.stringify({
          rolledBackOperationId: operationId,
          affectedAccounts,
          restoredStates,
          errors
        }),
        rollbackOperationId
      ]);

      // 标记原操作为已回滚
      await client.query(`
        UPDATE merge_operations 
        SET 
          status = CONCAT(status, '_rolled_back'),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [operationId]);

      await client.query('COMMIT'); // 提交事务

      return {
        success: errors.length === 0,
        operationId,
        affectedAccounts,
        restoredStates,
        errors,
        rollbackOperationId
      };

    } catch (error) {
      await client.query('ROLLBACK'); // 回滚事务
      console.error('回滚操作失败:', error);
      throw new Error(`回滚操作失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }

  /**
   * 清理过期审计数据
   */
  async cleanupOldAuditData(retentionDays: number = 365): Promise<{
    deletedOperations: number;
    deletedChanges: number;
  }> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      console.log(`清理 ${cutoffDate.toISOString()} 之前的审计数据...`);

      // 删除过期的分类变更记录（不删除手动分类的记录）
      const deletedChangesResult = await db.query(`
        DELETE FROM classification_audit 
        WHERE timestamp < $1 
        AND classification_source NOT IN ('manual', 'rollback')
        RETURNING id
      `, [cutoffDate]);

      // 删除过期的操作记录（保留有回滚数据的记录）
      const deletedOperationsResult = await db.query(`
        DELETE FROM merge_operations 
        WHERE timestamp < $1 
        AND (rollback_data IS NULL OR rollback_data = '{}')
        AND status NOT LIKE '%rollback%'
        RETURNING id
      `, [cutoffDate]);

      const deletedOperations = deletedOperationsResult.rows.length;
      const deletedChanges = deletedChangesResult.rows.length;

      console.log(`✅ 审计数据清理完成: 删除 ${deletedOperations} 个操作记录, ${deletedChanges} 个变更记录`);

      return { deletedOperations, deletedChanges };

    } catch (error) {
      console.error('清理审计数据失败:', error);
      throw new Error(`清理审计数据失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 导出审计报告
   */
  async exportAuditReport(startDate: Date, endDate: Date): Promise<{
    period: { start: Date; end: Date };
    summary: AuditStatistics;
    operations: MergeOperationRecord[];
    changes: ClassificationAuditRecord[];
    accountSummary: { [author: string]: { changeCount: number; latestStatus: string | null } };
  }> {
    try {
      // 获取指定期间的统计信息
      const operations = await this.getMergeOperations({
        startDate,
        endDate,
        limit: 1000
      });

      const changes = await this.getClassificationChanges({
        startDate,
        endDate,
        limit: 5000
      });

      // 生成账号变更摘要
      const accountSummary: { [author: string]: { changeCount: number; latestStatus: string | null } } = {};
      
      changes.changes.forEach(change => {
        if (!accountSummary[change.author]) {
          accountSummary[change.author] = {
            changeCount: 0,
            latestStatus: null
          };
        }
        accountSummary[change.author].changeCount++;
        // 因为变更记录按时间降序排序，第一次出现的就是最新状态
        if (accountSummary[change.author].latestStatus === null) {
          accountSummary[change.author].latestStatus = change.new_status;
        }
      });

      const summary = await this.getAuditStatistics();

      return {
        period: { start: startDate, end: endDate },
        summary,
        operations: operations.operations,
        changes: changes.changes,
        accountSummary
      };

    } catch (error) {
      console.error('导出审计报告失败:', error);
      throw new Error(`导出审计报告失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// 导出单例实例
export const auditService = new AuditService();