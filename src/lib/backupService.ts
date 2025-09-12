import { db } from './database';
import { TiktokRawData } from './database';

// 备份记录接口
export interface BackupRecord {
  id: string;
  operation_id: string | null;
  backup_type: 'full' | 'incremental' | 'selective';
  affected_accounts: string[];
  backup_data: any;
  metadata: any;
  created_at: Date;
  expires_at: Date;
  integrity_hash: string;
  status: 'created' | 'verified' | 'corrupted' | 'expired';
}

// 恢复选项接口
export interface RecoveryOptions {
  backupId: string;
  targetAccounts?: string[]; // 选择性恢复特定账号
  dryRun?: boolean; // 演示模式，不实际执行恢复
  overwriteExisting?: boolean; // 是否覆盖现有数据
}

// 恢复结果接口
export interface RecoveryResult {
  success: boolean;
  backupId: string;
  recoveredAccounts: number;
  skippedAccounts: number;
  errors: string[];
  recoveryOperationId?: string;
  executionTimeMs: number;
}

// 备份选项接口
export interface BackupOptions {
  operationId?: string;
  backupType?: 'full' | 'incremental' | 'selective';
  retentionDays?: number;
  includeMetadata?: boolean;
  verifyIntegrity?: boolean;
}

// 备份统计接口
export interface BackupStatistics {
  totalBackups: number;
  activeBackups: number;
  expiredBackups: number;
  corruptedBackups: number;
  totalSizeBytes: number;
  oldestBackup: Date | null;
  newestBackup: Date | null;
  backupsByType: { [type: string]: number };
}

/**
 * 备份服务类
 * 提供操作前数据备份和错误恢复机制
 */
export class BackupService {

  /**
   * 创建数据备份表（如果不存在）
   */
  async initializeBackupTable(): Promise<void> {
    try {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS data_backups (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          operation_id UUID REFERENCES merge_operations(id),
          backup_type VARCHAR(20) NOT NULL DEFAULT 'selective',
          affected_accounts TEXT[] NOT NULL,
          backup_data JSONB NOT NULL,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          integrity_hash VARCHAR(64) NOT NULL,
          status VARCHAR(20) DEFAULT 'created',
          
          -- 添加索引
          CONSTRAINT valid_backup_type CHECK (backup_type IN ('full', 'incremental', 'selective')),
          CONSTRAINT valid_status CHECK (status IN ('created', 'verified', 'corrupted', 'expired'))
        );
      `;

      await db.query(createTableSQL);

      // 创建相关索引
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_data_backups_operation ON data_backups(operation_id)',
        'CREATE INDEX IF NOT EXISTS idx_data_backups_created ON data_backups(created_at DESC)',
        'CREATE INDEX IF NOT EXISTS idx_data_backups_expires ON data_backups(expires_at)',
        'CREATE INDEX IF NOT EXISTS idx_data_backups_status ON data_backups(status)',
        'CREATE INDEX IF NOT EXISTS idx_data_backups_accounts ON data_backups USING GIN(affected_accounts)'
      ];

      for (const indexSQL of indexes) {
        await db.query(indexSQL);
      }

      console.log('✅ 备份表和索引创建完成');

    } catch (error) {
      console.error('初始化备份表失败:', error);
      throw new Error(`初始化备份表失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 创建操作前备份
   */
  async createBackup(
    affectedAccounts: string[], 
    options: BackupOptions = {}
  ): Promise<string> {
    try {
      const {
        operationId,
        backupType = 'selective',
        retentionDays = 30,
        includeMetadata = true,
        verifyIntegrity = true
      } = options;

      if (affectedAccounts.length === 0) {
        throw new Error('没有指定需要备份的账号');
      }

      console.log(`🔄 创建备份: ${backupType}类型，涉及 ${affectedAccounts.length} 个账号`);

      // 获取要备份的账号数据
      const placeholders = affectedAccounts.map((_, i) => `$${i + 1}`).join(',');
      const backupDataResult = await db.query(`
        SELECT 
          author,
          author_status,
          classification_source,
          classification_time,
          manual_classified,
          last_import_time,
          COUNT(*) as works_count,
          MAX(created_at) as latest_work_time
        FROM tiktok_videos_raw 
        WHERE author IN (${placeholders})
        GROUP BY author, author_status, classification_source, classification_time, manual_classified, last_import_time
        ORDER BY author
      `, affectedAccounts);

      const backupData = {
        accounts: backupDataResult.rows,
        timestamp: new Date().toISOString(),
        affectedAccounts,
        backupType,
        totalAccounts: affectedAccounts.length,
        actualDataRows: backupDataResult.rows.length
      };

      // 生成备份元数据
      const metadata = includeMetadata ? {
        operation_id: operationId,
        backup_size_bytes: JSON.stringify(backupData).length,
        account_distribution: this.generateAccountDistribution(backupDataResult.rows),
        creation_context: {
          user_agent: 'BackupService',
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        }
      } : {};

      // 计算完整性哈希
      const integrityHash = verifyIntegrity 
        ? this.calculateIntegrityHash(backupData)
        : 'not_verified';

      // 计算过期时间
      const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

      // 插入备份记录
      const insertResult = await db.query(`
        INSERT INTO data_backups (
          operation_id, backup_type, affected_accounts, backup_data,
          metadata, expires_at, integrity_hash, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        operationId,
        backupType,
        affectedAccounts,
        JSON.stringify(backupData),
        JSON.stringify(metadata),
        expiresAt,
        integrityHash,
        verifyIntegrity ? 'verified' : 'created'
      ]);

      const backupId = insertResult.rows[0].id;
      
      console.log(`✅ 备份创建成功: ${backupId}`);
      console.log(`   类型: ${backupType}`);
      console.log(`   账号数: ${affectedAccounts.length}`);
      console.log(`   过期时间: ${expiresAt.toISOString()}`);
      console.log(`   完整性验证: ${verifyIntegrity ? '已启用' : '已跳过'}`);

      return backupId;

    } catch (error) {
      console.error('创建备份失败:', error);
      throw new Error(`创建备份失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 恢复备份数据
   */
  async recoverFromBackup(options: RecoveryOptions): Promise<RecoveryResult> {
    const startTime = Date.now();
    const client = await db.getClient();

    try {
      const { backupId, targetAccounts, dryRun = false, overwriteExisting = false } = options;

      // 获取备份记录
      const backupResult = await client.query(`
        SELECT * FROM data_backups WHERE id = $1
      `, [backupId]);

      if (backupResult.rows.length === 0) {
        throw new Error(`备份 ${backupId} 不存在`);
      }

      const backup: BackupRecord = backupResult.rows[0];

      // 检查备份状态
      if (backup.status === 'corrupted') {
        throw new Error('备份数据已损坏，无法恢复');
      }

      if (backup.status === 'expired') {
        throw new Error('备份已过期，无法恢复');
      }

      // 验证备份完整性
      const backupData = backup.backup_data;
      if (backup.integrity_hash !== 'not_verified') {
        const currentHash = this.calculateIntegrityHash(backupData);
        if (currentHash !== backup.integrity_hash) {
          await client.query(`
            UPDATE data_backups SET status = 'corrupted' WHERE id = $1
          `, [backupId]);
          throw new Error('备份完整性验证失败，数据可能已损坏');
        }
      }

      console.log(`🔄 开始恢复备份: ${backupId}`);
      console.log(`   备份类型: ${backup.backup_type}`);
      console.log(`   创建时间: ${backup.created_at}`);
      console.log(`   演示模式: ${dryRun ? '是' : '否'}`);

      if (!dryRun) {
        await client.query('BEGIN'); // 开始事务
      }

      // 创建恢复操作记录
      let recoveryOperationId: string | null = null;
      if (!dryRun) {
        const recoveryOpResult = await client.query(`
          INSERT INTO merge_operations (
            strategy, operation_summary, status
          ) VALUES ($1, $2, $3)
          RETURNING id
        `, [
          'recovery',
          `从备份 ${backupId} 恢复数据`,
          'in_progress'
        ]);
        recoveryOperationId = recoveryOpResult.rows[0].id;
      }

      // 确定要恢复的账号
      const accountsToRecover = targetAccounts 
        ? backup.affected_accounts.filter(account => targetAccounts.includes(account))
        : backup.affected_accounts;

      let recoveredAccounts = 0;
      let skippedAccounts = 0;
      const errors: string[] = [];

      // 逐个恢复账号数据
      for (const accountData of backupData.accounts) {
        try {
          const { author } = accountData;

          // 检查是否在恢复列表中
          if (!accountsToRecover.includes(author)) {
            skippedAccounts++;
            continue;
          }

          if (!dryRun) {
            // 检查现有数据
            const existingResult = await client.query(`
              SELECT author_status, manual_classified FROM tiktok_videos_raw 
              WHERE author = $1 LIMIT 1
            `, [author]);

            const hasExistingData = existingResult.rows.length > 0;
            const existingData = existingResult.rows[0];

            // 如果有现有数据且不允许覆盖，跳过
            if (hasExistingData && !overwriteExisting && existingData.author_status) {
              skippedAccounts++;
              console.log(`⚠️ 跳过账号 ${author}: 已有数据且未启用覆盖模式`);
              continue;
            }

            // 恢复账号数据
            await client.query(`
              UPDATE tiktok_videos_raw 
              SET 
                author_status = $1,
                classification_source = $2,
                classification_time = $3,
                manual_classified = $4,
                last_import_time = CURRENT_TIMESTAMP
              WHERE author = $5
            `, [
              accountData.author_status,
              'recovery',
              accountData.classification_time || new Date(),
              accountData.manual_classified || false,
              author
            ]);

            // 记录恢复操作到审计表
            if (recoveryOperationId) {
              await client.query(`
                INSERT INTO classification_audit (
                  author, old_status, new_status, classification_source,
                  operation_id, additional_data
                ) VALUES ($1, $2, $3, $4, $5, $6)
              `, [
                author,
                hasExistingData ? existingData.author_status : null,
                accountData.author_status,
                'recovery',
                recoveryOperationId,
                JSON.stringify({
                  action: 'data_recovery',
                  source_backup_id: backupId,
                  recovery_timestamp: new Date().toISOString()
                })
              ]);
            }
          }

          recoveredAccounts++;

        } catch (error) {
          errors.push(`恢复账号 ${accountData.author} 失败: ${error instanceof Error ? error.message : String(error)}`);
          skippedAccounts++;
        }
      }

      // 更新恢复操作状态
      if (!dryRun && recoveryOperationId) {
        const executionTime = Date.now() - startTime;
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
          recoveredAccounts,
          executionTime,
          JSON.stringify({
            source_backup_id: backupId,
            recovered_accounts: recoveredAccounts,
            skipped_accounts: skippedAccounts,
            errors
          }),
          recoveryOperationId
        ]);
      }

      if (!dryRun) {
        await client.query('COMMIT'); // 提交事务
      }

      const executionTimeMs = Date.now() - startTime;

      console.log(`✅ 备份恢复完成`);
      console.log(`   恢复账号: ${recoveredAccounts}`);
      console.log(`   跳过账号: ${skippedAccounts}`);
      console.log(`   执行时间: ${executionTimeMs}ms`);
      console.log(`   错误数量: ${errors.length}`);

      return {
        success: errors.length === 0,
        backupId,
        recoveredAccounts,
        skippedAccounts,
        errors,
        recoveryOperationId: recoveryOperationId || undefined,
        executionTimeMs
      };

    } catch (error) {
      if (!dryRun) {
        await client.query('ROLLBACK'); // 回滚事务
      }
      console.error('恢复备份失败:', error);
      throw new Error(`恢复备份失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }

  /**
   * 获取备份列表
   */
  async getBackupList(options: {
    limit?: number;
    offset?: number;
    operationId?: string;
    status?: string;
    backupType?: string;
  } = {}): Promise<{
    backups: BackupRecord[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const { limit = 50, offset = 0, operationId, status, backupType } = options;

      // 构建查询条件
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (operationId) {
        conditions.push(`operation_id = $${paramIndex++}`);
        params.push(operationId);
      }

      if (status) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(status);
      }

      if (backupType) {
        conditions.push(`backup_type = $${paramIndex++}`);
        params.push(backupType);
      }

      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      // 查询总数
      const countResult = await db.query(`
        SELECT COUNT(*) as total FROM data_backups ${whereClause}
      `, params);
      const total = parseInt(countResult.rows[0].total);

      // 查询备份记录
      const backupsResult = await db.query(`
        SELECT * FROM data_backups ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `, [...params, limit, offset]);

      const backups: BackupRecord[] = backupsResult.rows.map(row => ({
        ...row,
        backup_data: row.backup_data || {},
        metadata: row.metadata || {}
      }));

      return {
        backups,
        total,
        hasMore: offset + backups.length < total
      };

    } catch (error) {
      console.error('获取备份列表失败:', error);
      throw new Error(`获取备份列表失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取备份统计信息
   */
  async getBackupStatistics(): Promise<BackupStatistics> {
    try {
      const now = new Date();

      const [
        totalResult,
        activeResult,
        expiredResult,
        corruptedResult,
        typeDistributionResult,
        dateRangeResult,
        sizeResult
      ] = await Promise.all([
        // 总备份数
        db.query('SELECT COUNT(*) as count FROM data_backups'),
        // 活跃备份数
        db.query('SELECT COUNT(*) as count FROM data_backups WHERE expires_at > $1 AND status != \'expired\'', [now]),
        // 过期备份数
        db.query('SELECT COUNT(*) as count FROM data_backups WHERE expires_at <= $1 OR status = \'expired\'', [now]),
        // 损坏备份数
        db.query('SELECT COUNT(*) as count FROM data_backups WHERE status = \'corrupted\''),
        // 类型分布
        db.query('SELECT backup_type, COUNT(*) as count FROM data_backups GROUP BY backup_type'),
        // 日期范围
        db.query('SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM data_backups'),
        // 估算总大小
        db.query('SELECT SUM(length(backup_data::text)) as total_size FROM data_backups')
      ]);

      const backupsByType: { [type: string]: number } = {};
      typeDistributionResult.rows.forEach(row => {
        backupsByType[row.backup_type] = parseInt(row.count);
      });

      return {
        totalBackups: parseInt(totalResult.rows[0].count),
        activeBackups: parseInt(activeResult.rows[0].count),
        expiredBackups: parseInt(expiredResult.rows[0].count),
        corruptedBackups: parseInt(corruptedResult.rows[0].count),
        totalSizeBytes: parseInt(sizeResult.rows[0].total_size) || 0,
        oldestBackup: dateRangeResult.rows[0].oldest,
        newestBackup: dateRangeResult.rows[0].newest,
        backupsByType
      };

    } catch (error) {
      console.error('获取备份统计失败:', error);
      throw new Error(`获取备份统计失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 清理过期备份
   */
  async cleanupExpiredBackups(): Promise<{
    deletedBackups: number;
    freedSpaceBytes: number;
  }> {
    try {
      const now = new Date();

      console.log('🧹 开始清理过期备份...');

      // 先标记过期的备份
      await db.query(`
        UPDATE data_backups 
        SET status = 'expired' 
        WHERE expires_at <= $1 AND status != 'expired'
      `, [now]);

      // 获取要删除的备份信息（用于统计）
      const expiredBackupsResult = await db.query(`
        SELECT id, length(backup_data::text) as size_bytes
        FROM data_backups 
        WHERE status = 'expired'
      `);

      const expiredBackups = expiredBackupsResult.rows;
      const totalSize = expiredBackups.reduce((sum, backup) => sum + parseInt(backup.size_bytes), 0);

      // 删除过期备份
      const deleteResult = await db.query(`
        DELETE FROM data_backups 
        WHERE status = 'expired'
        RETURNING id
      `);

      const deletedCount = deleteResult.rows.length;

      console.log(`✅ 过期备份清理完成: 删除 ${deletedCount} 个备份，释放 ${Math.round(totalSize / 1024)} KB`);

      return {
        deletedBackups: deletedCount,
        freedSpaceBytes: totalSize
      };

    } catch (error) {
      console.error('清理过期备份失败:', error);
      throw new Error(`清理过期备份失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 验证备份完整性
   */
  async verifyBackupIntegrity(backupId: string): Promise<{
    valid: boolean;
    currentHash: string;
    expectedHash: string;
    details?: string;
  }> {
    try {
      const backupResult = await db.query(`
        SELECT integrity_hash, backup_data, status FROM data_backups WHERE id = $1
      `, [backupId]);

      if (backupResult.rows.length === 0) {
        throw new Error(`备份 ${backupId} 不存在`);
      }

      const backup = backupResult.rows[0];
      const expectedHash = backup.integrity_hash;
      
      if (expectedHash === 'not_verified') {
        return {
          valid: true,
          currentHash: 'not_verified',
          expectedHash: 'not_verified',
          details: '该备份创建时未启用完整性验证'
        };
      }

      const currentHash = this.calculateIntegrityHash(backup.backup_data);
      const valid = currentHash === expectedHash;

      // 如果验证失败，更新状态
      if (!valid && backup.status !== 'corrupted') {
        await db.query(`
          UPDATE data_backups SET status = 'corrupted' WHERE id = $1
        `, [backupId]);
      }

      return {
        valid,
        currentHash,
        expectedHash,
        details: valid ? '备份完整性验证通过' : '备份数据可能已损坏'
      };

    } catch (error) {
      console.error('验证备份完整性失败:', error);
      throw new Error(`验证备份完整性失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 计算数据完整性哈希
   */
  private calculateIntegrityHash(data: any): string {
    // 简单的哈希实现，在生产环境中应该使用更强的哈希算法
    const crypto = require('crypto');
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * 生成账号分布统计
   */
  private generateAccountDistribution(accountData: any[]): any {
    const statusDistribution: { [status: string]: number } = {};
    const sourceDistribution: { [source: string]: number } = {};
    let manualClassifiedCount = 0;

    accountData.forEach(account => {
      // 状态分布
      const status = account.author_status || 'unclassified';
      statusDistribution[status] = (statusDistribution[status] || 0) + 1;

      // 来源分布
      const source = account.classification_source || 'unknown';
      sourceDistribution[source] = (sourceDistribution[source] || 0) + 1;

      // 手动分类计数
      if (account.manual_classified) {
        manualClassifiedCount++;
      }
    });

    return {
      total_accounts: accountData.length,
      status_distribution: statusDistribution,
      source_distribution: sourceDistribution,
      manual_classified_count: manualClassifiedCount
    };
  }
}

// 导出单例实例
export const backupService = new BackupService();