import { NextRequest } from 'next/server';
import { ApiHandler } from '@/lib/apiHandler';
import { ExcelParser } from '@/lib/excelParser';
import { ExcelDataProcessor } from '@/lib/dataProcessor';
import { BatchProcessor } from '@/lib/batchProcessor';
import { ErrorHandler } from '@/lib/errorHandler';

/**
 * POST /api/upload - 处理Excel文件上传
 */
export async function POST(request: NextRequest) {
  return ApiHandler.safeHandler(request, async (req) => {
    return ApiHandler.handleFileUpload(req, async (file) => {
      // 1. 解析Excel文件
      console.log(`📁 开始处理文件: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      
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

      // 3. 批量插入数据库
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

        console.log(`🎉 数据插入完成: ${insertResult.insertedRows} 行，耗时 ${processingTime}ms`);

        return {
          success: true,
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
            processingTime
          }
        };

      } catch (error) {
        console.error('❌ 批量插入失败:', error);
        const dbError = ErrorHandler.handleDatabaseError(
          error instanceof Error ? error : String(error)
        );
        return {
          success: false,
          errors: [dbError],
          warnings: []
        };
      }
    });
  });
}

// 支持的HTTP方法
export async function GET() {
  return ApiHandler.error(
    ErrorHandler.createError(
      'SYSTEM_ERROR' as any,
      '此端点只支持POST请求'
    ),
    405
  );
}