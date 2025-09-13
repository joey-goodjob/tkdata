import { Pool, PoolClient } from 'pg';

// 查询队列管理器
class QueryQueue {
  private runningQueries = 0;
  private readonly maxConcurrentQueries: number;
  private waitingQueue: Array<{
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    queryFn: () => Promise<any>;
    priority: number;
  }> = [];

  constructor(maxConcurrentQueries: number = 10) {
    this.maxConcurrentQueries = maxConcurrentQueries;
  }

  async executeQuery<T>(
    queryFn: () => Promise<T>,
    priority: number = 0
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queryItem = { resolve, reject, queryFn, priority };

      if (this.runningQueries < this.maxConcurrentQueries) {
        this.executeImmediately(queryItem);
      } else {
        // 按优先级排序插入队列
        this.waitingQueue.push(queryItem);
        this.waitingQueue.sort((a, b) => b.priority - a.priority);
        
        console.log(`📋 查询加入队列，当前运行: ${this.runningQueries}/${this.maxConcurrentQueries}, 队列长度: ${this.waitingQueue.length}`);
      }
    });
  }

  private async executeImmediately(queryItem: any) {
    this.runningQueries++;
    
    try {
      const result = await queryItem.queryFn();
      queryItem.resolve(result);
    } catch (error) {
      queryItem.reject(error);
    } finally {
      this.runningQueries--;
      this.processNext();
    }
  }

  private processNext() {
    if (this.waitingQueue.length > 0 && this.runningQueries < this.maxConcurrentQueries) {
      const nextQuery = this.waitingQueue.shift()!;
      this.executeImmediately(nextQuery);
    }
  }

  getStats() {
    return {
      running: this.runningQueries,
      maxConcurrent: this.maxConcurrentQueries,
      waiting: this.waitingQueue.length,
      utilizationRate: (this.runningQueries / this.maxConcurrentQueries * 100).toFixed(1) + '%'
    };
  }
}

// 数据库连接池单例
class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: Pool;
  private queryQueue: QueryQueue;

  private constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // 检测运行环境
    const isProduction = process.env.NODE_ENV === 'production';
    const isVercel = process.env.VERCEL === '1';
    
    console.log(`🔧 初始化数据库连接池 - 环境: ${isProduction ? '生产' : '开发'}, Vercel: ${isVercel}`);

    // 初始化查询队列管理器（Vercel环境更保守的并发数）
    this.queryQueue = new QueryQueue(isVercel ? 8 : 15);

    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // 优化后的连接池配置
      max: 20, // 统一设置为20个连接
      min: 2, // 最小保持2个连接
      idleTimeoutMillis: 30000, // 30秒空闲超时
      connectionTimeoutMillis: 30000, // 30秒连接超时
      acquireTimeoutMillis: 30000, // 30秒获取连接超时
      
      // 查询和语句超时配置
      query_timeout: 25000, // 25秒查询超时
      statement_timeout: 25000, // 25秒语句超时
      
      // SSL配置
      ssl: isProduction ? { 
        rejectUnauthorized: false 
      } : false,
      
      // 应用标识
      application_name: isVercel ? 'tkdata-vercel' : 'tkdata-local',
      
      // 连接保活配置
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000, // 10秒后开始保活检查
      
      // 连接验证
      allowExitOnIdle: false, // 防止池在空闲时退出
    });

    // 监听连接池错误
    this.pool.on('error', (err) => {
      console.error('❌ 数据库连接池错误:', err.message);
    });

    // Vercel环境下添加更多监听
    if (isVercel) {
      this.pool.on('connect', (client) => {
        console.log('🔗 Vercel环境建立数据库连接');
      });
      
      this.pool.on('acquire', (client) => {
        console.log('📥 Vercel环境获取连接');
      });
      
      this.pool.on('release', (client) => {
        console.log('📤 Vercel环境释放连接');
      });
    }
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

  public async query(text: string, params?: any[], priority: number = 0) {
    // 使用查询队列管理并发
    return await this.queryQueue.executeQuery(async () => {
      const isVercel = process.env.VERCEL === '1';
      const maxRetries = isVercel ? 3 : 1;
      const queryTimeout = 25000; // 25秒查询超时
      
      let lastError: any;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let client: PoolClient | null = null;
        
        try {
          const queueStats = this.queryQueue.getStats();
          console.log(`🔍 数据库查询尝试 ${attempt}/${maxRetries} ${isVercel ? '(Vercel)' : '(Local)'} - 队列状态: ${queueStats.utilizationRate}`);
          const startTime = Date.now();
          
          // 获取连接，带超时保护
          client = await Promise.race([
            this.getClient(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('获取数据库连接超时')), 25000)
            )
          ]);
          
          // 执行查询，带超时保护
          const result = await Promise.race([
            client.query(text, params),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('数据库查询执行超时')), queryTimeout)
            )
          ]);
          
          const duration = Date.now() - startTime;
          console.log(`✅ 数据库查询成功 ${isVercel ? '(Vercel)' : '(Local)'} - ${duration}ms`);
          
          return result;
          
        } catch (error: any) {
          lastError = error;
          console.error(`❌ 数据库查询尝试 ${attempt} 失败 ${isVercel ? '(Vercel)' : '(Local)'}:`, error.message);
          
          // 在最后一次尝试或非网络错误时，直接抛出错误
          if (attempt === maxRetries || !this.isRetryableError(error)) {
            throw error;
          }
          
          // 重试前等待（指数退避）
          const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`⏳ ${retryDelay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          
        } finally {
          if (client) {
            try {
              client.release();
            } catch (releaseError) {
              console.error('❌ 释放数据库连接失败:', releaseError);
            }
          }
        }
      }
      
      throw lastError;
    }, priority);
  }

  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'Connection terminated',
      'Connection timeout',
      'timeout exceeded',
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      'connection terminated unexpectedly'
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    return retryableErrors.some(err => errorMessage.includes(err.toLowerCase()));
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

  // 获取查询队列统计信息
  public getQueryStats() {
    return this.queryQueue.getStats();
  }

  // 获取连接池统计信息
  public getPoolStats() {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingConnections: this.pool.waitingCount,
      connectionPoolSize: this.pool.options.max
    };
  }

  // 连接健康检查
  public async healthCheck(): Promise<{
    database: boolean;
    pool: any;
    queue: any;
    latency: number;
  }> {
    const startTime = Date.now();
    
    try {
      await this.query('SELECT 1 as health_check', [], 10); // 高优先级健康检查
      const latency = Date.now() - startTime;
      
      return {
        database: true,
        pool: this.getPoolStats(),
        queue: this.getQueryStats(),
        latency
      };
    } catch (error) {
      return {
        database: false,
        pool: this.getPoolStats(),
        queue: this.getQueryStats(),
        latency: Date.now() - startTime
      };
    }
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
    // 注意：生产环境暂不支持deleted_at字段，跳过删除状态检查
    // 如果需要软删除功能，请先在数据库中添加deleted_at字段

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