import { DatabaseService, TiktokRawData, BatchInsertResult } from './database';

/**
 * 高性能批量数据处理器
 * 优化批量插入性能，使用PostgreSQL的多行INSERT语法
 */
export class BatchProcessor {
  private dbService: DatabaseService;

  constructor() {
    this.dbService = new DatabaseService();
  }

  /**
   * 优化的批量插入方法
   * 使用多行INSERT语句而非逐行插入
   */
  async insertTiktokDataOptimized(
    data: TiktokRawData[],
    batchSize: number = 500,
    onProgress?: (progress: { current: number; total: number; percentage: number; currentBatch: number; totalBatches: number }) => void
  ): Promise<BatchInsertResult> {
    const result: BatchInsertResult = {
      success: false,
      totalRows: data.length,
      insertedRows: 0,
      failedRows: 0,
      errors: [],
      batches: [],
      processingTime: 0
    };

    if (data.length === 0) {
      result.success = true;
      return result;
    }

    const startTime = Date.now();
    const totalBatches = Math.ceil(data.length / batchSize);

    try {
      // 获取所有可能的字段名
      const allFields = this.getAllFields(data);
      
      // 分批处理
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        
        try {
          const insertedCount = await this.insertBatchOptimized(batch, allFields, batchNumber);
          
          result.insertedRows += insertedCount;
          result.batches.push({
            batchNumber,
            success: true,
            insertedRows: insertedCount,
            failedRows: 0,
            errors: []
          });

          // 报告进度
          if (onProgress) {
            const progress = {
              current: i + batch.length,
              total: data.length,
              percentage: Math.round(((i + batch.length) / data.length) * 100),
              currentBatch: batchNumber,
              totalBatches
            };
            onProgress(progress);
          }

          console.log(`✅ 批次 ${batchNumber}/${totalBatches} 完成: ${insertedCount} 行`);
          
        } catch (error) {
          const errorMsg = `批次 ${batchNumber} 失败: ${error instanceof Error ? error.message : String(error)}`;
          console.error(`❌ ${errorMsg}`);
          
          result.errors.push(errorMsg);
          result.failedRows += batch.length;
          result.batches.push({
            batchNumber,
            success: false,
            insertedRows: 0,
            failedRows: batch.length,
            errors: [errorMsg]
          });

          // 立即停止策略
          throw new Error(`批次插入失败，停止处理: ${errorMsg}`);
        }
      }

      result.success = result.failedRows === 0;
      result.processingTime = Date.now() - startTime;
      
      console.log(`🎉 批量插入完成: ${result.insertedRows}/${result.totalRows} 行，耗时 ${result.processingTime}ms`);
      
      return result;
      
    } catch (error) {
      result.success = false;
      result.processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (!result.errors.includes(errorMessage)) {
        result.errors.push(errorMessage);
      }
      
      throw error;
    }
  }

  /**
   * 优化的单批次插入
   * 使用多行INSERT VALUES语法
   */
  private async insertBatchOptimized(
    batch: TiktokRawData[], 
    allFields: string[], 
    batchNumber: number
  ): Promise<number> {
    if (batch.length === 0) return 0;

    const { db } = await import('./database');
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // 准备批量插入的数据
      const values: any[] = [];
      const placeholders: string[] = [];
      
      // 添加时间戳字段
      const fieldsWithTimestamp = [...allFields, 'created_at', 'updated_at'];
      
      batch.forEach((row, index) => {
        const rowValues: any[] = [];
        const rowPlaceholders: string[] = [];
        
        // 处理所有字段
        allFields.forEach(field => {
          const value = row[field as keyof TiktokRawData];
          rowValues.push(value !== undefined ? value : null);
        });
        
        // 添加时间戳
        rowValues.push(new Date(), new Date());
        
        // 创建占位符
        const startIndex = values.length;
        fieldsWithTimestamp.forEach((_, fieldIndex) => {
          rowPlaceholders.push(`$${startIndex + fieldIndex + 1}`);
        });
        
        values.push(...rowValues);
        placeholders.push(`(${rowPlaceholders.join(', ')})`);
      });

      // 构建批量插入SQL
      const query = `
        INSERT INTO tiktok_videos_raw (${fieldsWithTimestamp.join(', ')})
        VALUES ${placeholders.join(', ')}
      `;
      
      const result = await client.query(query, values);
      
      await client.query('COMMIT');
      
      return result.rowCount || 0;
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`批次 ${batchNumber} 插入失败:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取数据中所有可能的字段名
   */
  private getAllFields(data: TiktokRawData[]): string[] {
    const fieldsSet = new Set<string>();
    
    // 预定义的字段顺序（基于数据库表结构）
    const predefinedFields = [
      'is_selected', 'serial_number', 'work_id', 'work_type', 'extract_type',
      'search_keyword', 'author', 'author_fans_count', 'author_homepage',
      'author_homepage_note', 'author_uid', 'author_sec_uid', 'work_title',
      'play_count', 'like_count', 'comment_count', 'collect_count', 'share_count',
      'work_quality', 'work_duration', 'work_duration_seconds', 'work_url',
      'publish_time', 'work_note', 'cover_url', 'disable_download',
      'video_source_url', 'image_download_url', 'image_music_download_url',
      'video_id', 'topic_content', 'download_status', 'save_path', 'is_voice_transcribed'
    ];

    // 从数据中收集所有字段
    data.forEach(row => {
      Object.keys(row).forEach(key => fieldsSet.add(key));
    });

    // 按预定义顺序返回字段，未预定义的字段放在最后
    const orderedFields: string[] = [];
    
    predefinedFields.forEach(field => {
      if (fieldsSet.has(field)) {
        orderedFields.push(field);
        fieldsSet.delete(field);
      }
    });
    
    // 添加剩余字段
    orderedFields.push(...Array.from(fieldsSet));
    
    return orderedFields;
  }

  /**
   * 验证批量数据的完整性
   */
  validateBatchData(data: TiktokRawData[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.length === 0) {
      errors.push('数据为空');
      return { valid: false, errors };
    }

    // 检查每行数据
    data.forEach((row, index) => {
      if (!row.work_id && !row.video_id) {
        errors.push(`第 ${index + 1} 行: 缺少work_id或video_id`);
      }

      if (!row.author) {
        errors.push(`第 ${index + 1} 行: 缺少author字段`);
      }

      // 检查数值字段
      const numberFields: (keyof TiktokRawData)[] = [
        'play_count', 'like_count', 'comment_count', 'collect_count', 'share_count'
      ];

      numberFields.forEach(field => {
        const value = row[field];
        if (value !== undefined && typeof value !== 'number') {
          errors.push(`第 ${index + 1} 行: ${field} 应该是数值类型`);
        }
      });
    });

    return { valid: errors.length === 0, errors };
  }

  /**
   * 获取处理统计信息
   */
  getProcessingStats(result: BatchInsertResult): {
    successRate: number;
    averageBatchTime: number;
    recordsPerSecond: number;
    totalBatches: number;
  } {
    return {
      successRate: result.totalRows > 0 ? (result.insertedRows / result.totalRows) * 100 : 0,
      averageBatchTime: result.batches.length > 0 ? result.processingTime / result.batches.length : 0,
      recordsPerSecond: result.processingTime > 0 ? Math.round(result.insertedRows / (result.processingTime / 1000)) : 0,
      totalBatches: result.batches.length
    };
  }
}