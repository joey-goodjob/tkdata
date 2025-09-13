import { Pool, PoolClient } from 'pg';

// 数据库连接池单例
class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: Pool;

  private constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20, // 最大连接数
      idleTimeoutMillis: 30000, // 空闲超时时间
      connectionTimeoutMillis: 2000, // 连接超时时间
    });

    // 监听连接池错误
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  public async query(text: string, params?: any[]) {
    const client = await this.getClient();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  public async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW()');
      console.log('Database connection test successful:', result.rows[0]);
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

// 导出数据库实例
export const db = DatabaseConnection.getInstance();

// 批次处理结果类型
export interface BatchResult {
  batchNumber: number;
  success: boolean;
  insertedRows: number;
  failedRows: number;
  errors: string[];
}

// 批量插入结果类型
export interface BatchInsertResult {
  success: boolean;
  totalRows: number;
  insertedRows: number;
  failedRows: number;
  errors: string[];
  batches: BatchResult[];
  processingTime: number;
}

// TikTok原始数据类型定义
export interface TiktokRawData {
  is_selected?: boolean;
  serial_number?: string;
  work_id?: string;
  work_type?: string;
  extract_type?: string;
  search_keyword?: string;
  author?: string;
  author_status?: string;               // 新增：账号状态字段
  author_fans_count?: number;
  author_homepage?: string;
  author_homepage_note?: string;
  author_uid?: string;
  author_sec_uid?: string;
  work_title?: string;
  play_count?: number;
  like_count?: number;
  comment_count?: number;
  collect_count?: number;
  share_count?: number;
  work_quality?: string;
  work_duration?: string;
  work_duration_seconds?: number;
  work_url?: string;
  publish_time?: Date;
  work_note?: string;
  cover_url?: string;
  disable_download?: boolean;
  video_source_url?: string;
  image_download_url?: string;
  image_music_download_url?: string;
  video_id?: string;
  topic_content?: string;
  download_status?: string;
  save_path?: string;
  is_voice_transcribed?: boolean;
}

// 数据库服务类
export class DatabaseService {
  private db: DatabaseConnection;

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  // 批量插入TikTok数据（改进版本）
  async insertTiktokData(
    data: TiktokRawData[], 
    batchSize: number = 500,
    onProgress?: (progress: { current: number; total: number; percentage: number }) => void
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

    const startTime = Date.now();
    
    try {
      // 分批处理
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const batchResult = await this.insertBatch(batch, batchNumber);
        
        result.batches.push(batchResult);
        result.insertedRows += batchResult.insertedRows;
        result.failedRows += batchResult.failedRows;
        
        if (batchResult.errors.length > 0) {
          result.errors.push(...batchResult.errors);
        }

        // 报告进度
        if (onProgress) {
          const progress = {
            current: i + batch.length,
            total: data.length,
            percentage: Math.round(((i + batch.length) / data.length) * 100)
          };
          onProgress(progress);
        }

        // 如果批次失败，根据错误处理策略决定是否继续
        if (!batchResult.success) {
          const error = `批次 ${batchNumber} 插入失败: ${batchResult.errors.join(', ')}`;
          console.error(error);
          result.errors.push(error);
          
          // 立即停止策略：任何批次失败都停止整个处理
          result.success = false;
          result.processingTime = Date.now() - startTime;
          throw new Error(`数据插入在批次 ${batchNumber} 失败，停止处理`);
        }

        console.log(`✅ 批次 ${batchNumber}/${Math.ceil(data.length / batchSize)} 完成: ${batchResult.insertedRows} 行`);
      }

      result.success = result.failedRows === 0;
      result.processingTime = Date.now() - startTime;
      
      console.log(`🎉 数据插入完成: ${result.insertedRows}/${result.totalRows} 行，耗时 ${result.processingTime}ms`);
      
      return result;
      
    } catch (error) {
      result.success = false;
      result.processingTime = Date.now() - startTime;
      result.errors.push(error instanceof Error ? error.message : String(error));
      
      console.error('❌ 批量插入失败:', error);
      throw error;
    }
  }

  // 单批次插入处理
  private async insertBatch(batch: TiktokRawData[], batchNumber: number): Promise<BatchResult> {
    const result: BatchResult = {
      batchNumber,
      success: false,
      insertedRows: 0,
      failedRows: 0,
      errors: []
    };

    const client = await this.db.getClient();
    
    try {
      await client.query('BEGIN');
      
      for (let i = 0; i < batch.length; i++) {
        try {
          const row = batch[i];
          await this.insertSingleRow(client, row);
          result.insertedRows++;
        } catch (error) {
          result.failedRows++;
          const errorMsg = `批次 ${batchNumber} 第 ${i + 1} 行: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          
          // 立即停止：单行失败就回滚整个批次
          throw error;
        }
      }
      
      await client.query('COMMIT');
      result.success = true;
      
    } catch (error) {
      await client.query('ROLLBACK');
      result.success = false;
      
      if (result.errors.length === 0) {
        result.errors.push(error instanceof Error ? error.message : String(error));
      }
      
    } finally {
      client.release();
    }
    
    return result;
  }

  // 单行数据插入
  private async insertSingleRow(client: any, row: TiktokRawData): Promise<void> {
    // 检查该账号是否已被删除
    if (row.author) {
      const deletedCheck = await client.query(`
        SELECT author FROM tiktok_videos_raw 
        WHERE author = $1 AND deleted_at IS NOT NULL
        LIMIT 1
      `, [row.author]);
      
      if (deletedCheck.rows.length > 0) {
        console.log(`⚠️  跳过已删除账号: ${row.author}`);
        return; // 跳过已删除的账号
      }
    }

    // 过滤掉undefined的字段
    const validFields = Object.entries(row)
      .filter(([_, value]) => value !== undefined && value !== null)
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {} as any);

    const fields = Object.keys(validFields);
    const values = Object.values(validFields);
    
    if (fields.length === 0) {
      throw new Error('没有有效的字段数据');
    }

    // 添加时间戳和导入溯源字段
    fields.push('created_at', 'updated_at', 'classification_source', 'last_import_time');
    values.push(new Date(), new Date(), 'import', new Date());

    const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');
    
    const query = `
      INSERT INTO tiktok_videos_raw (${fields.join(', ')})
      VALUES (${placeholders})
    `;
    
    await client.query(query, values);
  }

  // 测试数据库连接和表结构
  async testTableAccess(): Promise<boolean> {
    try {
      const result = await this.db.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'tiktok_videos_raw' 
        ORDER BY ordinal_position
      `);
      
      if (result.rows.length === 0) {
        console.error('Table tiktok_videos_raw not found');
        return false;
      }
      
      console.log('Table structure verified. Columns:', result.rows.length);
      return true;
    } catch (error) {
      console.error('Error accessing tiktok_videos_raw table:', error);
      return false;
    }
  }
}