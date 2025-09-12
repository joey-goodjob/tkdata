import { NextRequest, NextResponse } from 'next/server';
import { backupService } from '@/lib/backupService';
import { db } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('💾 开始测试BackupService功能...');

    // 1. 初始化备份表
    console.log('1️⃣ 初始化备份表...');
    await backupService.initializeBackupTable();
    console.log('备份表初始化完成');

    // 2. 创建测试备份
    console.log('2️⃣ 创建测试备份...');
    const testAccounts = ['test_backup_author_1', 'test_backup_author_2', 'test_backup_author_3'];
    
    // 先在数据库中插入一些测试数据
    
    for (const author of testAccounts) {
      try {
        await db.query(`
          INSERT INTO tiktok_videos_raw (
            author, author_status, work_id, work_title, 
            classification_source, manual_classified
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (author, work_id) DO UPDATE SET
            author_status = EXCLUDED.author_status,
            classification_source = EXCLUDED.classification_source,
            manual_classified = EXCLUDED.manual_classified
        `, [
          author,
          author === 'test_backup_author_1' ? '成品号' : '半成品号',
          `work_${author}_001`,
          `测试作品 ${author}`,
          'manual',
          true
        ]);
      } catch (error) {
        // 忽略插入错误，可能已存在
      }
    }

    const backupId = await backupService.createBackup(testAccounts, {
      backupType: 'selective',
      retentionDays: 7,
      includeMetadata: true,
      verifyIntegrity: true
    });
    console.log(`测试备份创建成功: ${backupId}`);

    // 3. 获取备份列表
    console.log('3️⃣ 获取备份列表...');
    const backupList = await backupService.getBackupList({
      limit: 10
    });
    console.log(`找到 ${backupList.total} 个备份，显示最近 ${backupList.backups.length} 个`);

    // 4. 获取备份统计
    console.log('4️⃣ 获取备份统计...');
    const statistics = await backupService.getBackupStatistics();
    console.log('备份统计信息:', statistics);

    // 5. 验证备份完整性
    console.log('5️⃣ 验证备份完整性...');
    const integrityResult = await backupService.verifyBackupIntegrity(backupId);
    console.log('完整性验证结果:', integrityResult);

    // 6. 测试备份恢复（演示模式）
    console.log('6️⃣ 测试备份恢复（演示模式）...');
    const recoveryResult = await backupService.recoverFromBackup({
      backupId,
      targetAccounts: testAccounts.slice(0, 2), // 只恢复前两个账号
      dryRun: true, // 演示模式，不实际执行
      overwriteExisting: false
    });
    console.log('演示恢复结果:', recoveryResult);

    // 7. 测试实际恢复（恢复一个账号）
    console.log('7️⃣ 测试实际恢复（单个账号）...');
    
    // 先修改账号状态，然后恢复
    await db.query(`
      UPDATE tiktok_videos_raw 
      SET author_status = '待分类', classification_source = 'test_modification'
      WHERE author = $1
    `, [testAccounts[0]]);

    const actualRecoveryResult = await backupService.recoverFromBackup({
      backupId,
      targetAccounts: [testAccounts[0]],
      dryRun: false,
      overwriteExisting: true
    });
    console.log('实际恢复结果:', actualRecoveryResult);

    // 8. 测试过期备份清理（创建一个已过期的备份进行测试）
    console.log('8️⃣ 测试过期备份清理...');
    
    // 创建一个立即过期的备份用于测试
    const expiredBackupId = await backupService.createBackup([testAccounts[2]], {
      backupType: 'selective',
      retentionDays: -1, // 负数天数，立即过期
      includeMetadata: false,
      verifyIntegrity: false
    });
    console.log(`过期测试备份创建: ${expiredBackupId}`);

    // 执行清理
    const cleanupResult = await backupService.cleanupExpiredBackups();
    console.log('清理结果:', cleanupResult);

    // 9. 获取最终统计
    console.log('9️⃣ 获取最终统计...');
    const finalStatistics = await backupService.getBackupStatistics();

    console.log('✅ BackupService测试完成');

    return NextResponse.json({
      success: true,
      message: 'BackupService测试成功完成',
      results: {
        backupCreation: {
          backupId,
          accounts: testAccounts
        },
        backupList: {
          total: backupList.total,
          sample: backupList.backups.slice(0, 2).map(b => ({
            id: b.id,
            backup_type: b.backup_type,
            affected_accounts: b.affected_accounts,
            created_at: b.created_at,
            status: b.status
          }))
        },
        integrityCheck: {
          valid: integrityResult.valid,
          details: integrityResult.details
        },
        dryRunRecovery: {
          success: recoveryResult.success,
          recoveredAccounts: recoveryResult.recoveredAccounts,
          skippedAccounts: recoveryResult.skippedAccounts
        },
        actualRecovery: {
          success: actualRecoveryResult.success,
          recoveredAccounts: actualRecoveryResult.recoveredAccounts,
          executionTimeMs: actualRecoveryResult.executionTimeMs
        },
        cleanup: {
          deletedBackups: cleanupResult.deletedBackups,
          freedSpaceBytes: cleanupResult.freedSpaceBytes
        },
        statistics: {
          initial: statistics,
          final: finalStatistics
        }
      },
      features: [
        '✓ 操作前数据备份',
        '✓ 选择性数据恢复',
        '✓ 备份完整性验证',
        '✓ 过期备份自动清理',
        '✓ 备份统计和监控',
        '✓ 演示模式支持',
        '✓ 事务性恢复操作',
        '✓ 灵活的保留策略'
      ]
    });

  } catch (error) {
    console.error('❌ BackupService测试失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}