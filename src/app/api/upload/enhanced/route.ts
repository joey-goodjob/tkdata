import { NextRequest } from 'next/server';
import { ApiHandler } from '@/lib/apiHandler';
import { ExcelParser } from '@/lib/excelParser';
import { ExcelDataProcessor } from '@/lib/dataProcessor';
import { BatchProcessor } from '@/lib/batchProcessor';
import { ErrorHandler } from '@/lib/errorHandler';
import { mergeEngine, MergeStrategy, MergeOptions } from '@/lib/mergeEngine';
import { backupService } from '@/lib/backupService';

/**
 * POST /api/upload/enhanced - 增强版Excel文件上传，支持冲突检测
 */
export async function POST(request: NextRequest) {
  return ApiHandler.safeHandler(request, async (req) => {
    return ApiHandler.handleFileUpload(req, async (file) => {
      // 解析查询参数或表单数据中的选项
      const url = new URL(req.url);
      const conflictDetection = url.searchParams.get('conflictDetection') === 'true';
      const strategy = url.searchParams.get('strategy') || 'protect';
      const userId = url.searchParams.get('userId') || 'system';
      const createBackup = url.searchParams.get('createBackup') !== 'false'; // 默认创建备份

      console.log(`📁 开始处理文件: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      console.log(`🔍 冲突检测模式: ${conflictDetection ? '启用' : '禁用'}`);
      if (conflictDetection) {
        console.log(`⚙️ 合并策略: ${strategy}`);
        console.log(`👤 用户ID: ${userId}`);
      }

      // 1. 解析Excel文件
      const parseResult = await ExcelParser.parseFile(file);
      if (!parseResult.success) {
        const error = ErrorHandler.handleFileError(
          parseResult.error || 'Excel解析失败',
          file.name
        );
        return {
          success: false,
          errors: [error],
          warnings: []
        };
      }

      console.log(`📊 Excel解析完成: ${parseResult.totalRows} 行数据，${parseResult.headers?.length} 个字段`);

      // 2. 处理和验证数据
      const processingResult = await ExcelDataProcessor.processExcelData(
        parseResult.data || [],
        parseResult.headers || []
      );

      if (!processingResult.success) {
        const errors = processingResult.errors.map(errorMsg => 
          ErrorHandler.handleValidationError(errorMsg)
        );
        return {
          success: false,
          errors,
          warnings: []
        };
      }

      console.log(`✅ 数据验证完成: ${processingResult.validRows} 行有效数据`);

      if (!processingResult.data || processingResult.data.length === 0) {
        const error = ErrorHandler.createError(
          'NO_DATA_ROWS' as any,
          '没有有效的数据行可以插入'
        );
        return {
          success: false,
          errors: [error],
          warnings: []
        };
      }

      // 3. 冲突检测流程（如果启用）
      if (conflictDetection) {
        console.log('🔍 开始冲突检测...');

        try {
          // 生成合并预览
          const mergeStrategy = strategy as MergeStrategy;
          const preview = await mergeEngine.generatePreview(
            processingResult.data,
            mergeStrategy
          );

          console.log(`📊 冲突检测完成:`);
          console.log(`   总记录数: ${preview.totalRecords}`);
          console.log(`   冲突数量: ${preview.conflictCount}`);
          console.log(`   新账号数: ${preview.newAccountCount}`);
          console.log(`   保护数量: ${preview.protectedCount}`);
          console.log(`   更新数量: ${preview.updateCount}`);

          // 如果有冲突且策略为交互式，返回冲突信息供用户选择
          if (preview.conflictCount > 0 && mergeStrategy === MergeStrategy.INTERACTIVE) {
            return {
              success: true,
              requiresUserInput: true,
              preview,
              data: {
                totalRows: parseResult.totalRows,
                validRows: processingResult.validRows,
                conflicts: preview.conflicts,
                summary: preview.summary
              },
              message: `发现 ${preview.conflictCount} 个冲突，需要用户决策`,
              nextStep: 'POST /api/upload/execute - 提供冲突解决方案后执行合并'
            };
          }

          // 创建备份（如果启用）
          let backupId: string | undefined;
          if (createBackup && (preview.updateCount > 0 || preview.newAccountCount > 0)) {
            const affectedAccounts = Array.from(new Set(
              processingResult.data
                .map(record => record.author)
                .filter(author => author && author.trim())
            ));

            if (affectedAccounts.length > 0) {
              console.log(`💾 创建备份，涉及 ${affectedAccounts.length} 个账号...`);
              backupId = await backupService.createBackup(affectedAccounts, {
                backupType: 'selective',
                retentionDays: 30,
                includeMetadata: true,
                verifyIntegrity: true
              });
              console.log(`✅ 备份创建完成: ${backupId}`);
            }
          }

          // 执行智能合并
          console.log(`🚀 开始执行智能合并 (${mergeStrategy} 策略)...`);
          const mergeOptions: MergeOptions = {
            strategy: mergeStrategy,
            userId,
            dryRun: false
          };

          const mergeResult = await mergeEngine.executeMerge(
            processingResult.data,
            mergeOptions
          );

          if (!mergeResult.success || mergeResult.errors.length > 0) {
            return {
              success: false,
              errors: mergeResult.errors.map(err => 
                ErrorHandler.handleDatabaseError(err)
              ),
              warnings: [],
              rollbackInfo: backupId ? {
                backupId,
                message: '如需回滚，请使用备份ID进行数据恢复'
              } : undefined
            };
          }

          console.log(`🎉 智能合并完成:`);
          console.log(`   处理账号: ${mergeResult.processedAccounts}`);
          console.log(`   更新账号: ${mergeResult.updatedAccounts}`);
          console.log(`   保护账号: ${mergeResult.protectedAccounts}`);
          console.log(`   新增账号: ${mergeResult.newAccounts}`);

          return {
            success: true,
            conflictDetectionEnabled: true,
            data: {
              totalRows: parseResult.totalRows,
              validRows: processingResult.validRows,
              processedAccounts: mergeResult.processedAccounts,
              updatedAccounts: mergeResult.updatedAccounts,
              protectedAccounts: mergeResult.protectedAccounts,
              newAccounts: mergeResult.newAccounts,
              conflictsResolved: mergeResult.conflictsResolved,
              executionTimeMs: mergeResult.executionTimeMs,
              operationId: mergeResult.operationId,
              strategy: mergeStrategy
            },
            preview,
            backup: backupId ? {
              backupId,
              message: '已创建操作前备份'
            } : undefined,
            errors: [],
            warnings: mergeResult.errors,
            message: `智能合并成功完成，处理了 ${mergeResult.processedAccounts} 个账号`
          };

        } catch (error) {
          console.error('❌ 冲突检测或智能合并失败:', error);
          const mergeError = ErrorHandler.handleDatabaseError(
            error instanceof Error ? error.message : String(error)
          );
          return {
            success: false,
            errors: [mergeError],
            warnings: []
          };
        }
      } else {
        // 4. 传统批量插入流程（向后兼容）
        console.log('📤 使用传统批量插入模式...');
        
        const batchProcessor = new BatchProcessor();
        const startTime = Date.now();

        try {
          const insertResult = await batchProcessor.insertTiktokDataOptimized(
            processingResult.data,
            500,
            (progress) => {
              console.log(`🔄 处理进度: ${progress.percentage}% (${progress.current}/${progress.total} 行)`);
            }
          );

          const processingTime = Date.now() - startTime;

          if (!insertResult.success) {
            const errors = insertResult.errors.map(errorMsg => 
              ErrorHandler.handleDatabaseError(errorMsg)
            );
            return {
              success: false,
              errors,
              warnings: []
            };
          }

          console.log(`🎉 传统数据插入完成: ${insertResult.insertedRows} 行，耗时 ${processingTime}ms`);

          return {
            success: true,
            conflictDetectionEnabled: false,
            data: {
              totalRows: parseResult.totalRows,
              validRows: processingResult.validRows,
              insertedRows: insertResult.insertedRows,
              processingTime
            },
            errors: [],
            warnings: [],
            metadata: {
              totalRows: parseResult.totalRows,
              processedRows: insertResult.insertedRows,
              validRows: processingResult.validRows,
              processingTime,
              uploadMode: 'traditional'
            },
            message: `传统上传成功完成，插入了 ${insertResult.insertedRows} 行数据`
          };

        } catch (error) {
          console.error('❌ 传统批量插入失败:', error);
          const dbError = ErrorHandler.handleDatabaseError(
            error instanceof Error ? error.message : String(error)
          );
          return {
            success: false,
            errors: [dbError],
            warnings: []
          };
        }
      }
    });
  });
}

// 支持的HTTP方法
export async function GET() {
  return ApiHandler.success({
    message: '增强版上传API端点',
    features: [
      '✓ 向后兼容传统上传',
      '✓ 智能冲突检测',
      '✓ 三种合并策略',
      '✓ 自动备份创建',
      '✓ 交互式冲突解决',
      '✓ 详细操作审计'
    ],
    usage: {
      endpoint: 'POST /api/upload/enhanced',
      parameters: {
        conflictDetection: 'true/false - 启用冲突检测模式',
        strategy: 'protect/overwrite/interactive - 合并策略',
        userId: 'string - 用户ID（用于审计）',
        createBackup: 'true/false - 创建操作前备份（默认true）'
      },
      examples: [
        'POST /api/upload/enhanced - 传统上传模式',
        'POST /api/upload/enhanced?conflictDetection=true&strategy=protect - 保护模式上传',
        'POST /api/upload/enhanced?conflictDetection=true&strategy=interactive - 交互式模式'
      ]
    }
  });
}