import { db } from './database';

/**
 * 数据库设置和索引优化工具
 */
export class DatabaseSetup {
  
  /**
   * 验证author_status字段是否存在
   */
  async verifyAuthorStatusField(): Promise<boolean> {
    try {
      const result = await db.query(`
        SELECT column_name, data_type, character_maximum_length, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'tiktok_videos_raw' 
        AND column_name = 'author_status'
      `);
      
      if (result.rows.length === 0) {
        console.log('❌ author_status字段不存在，需要创建');
        return false;
      }
      
      const field = result.rows[0];
      console.log('✅ author_status字段已存在:');
      console.log(`  - 数据类型: ${field.data_type}`);
      console.log(`  - 最大长度: ${field.character_maximum_length || 'N/A'}`);
      console.log(`  - 允许NULL: ${field.is_nullable}`);
      
      return true;
    } catch (error) {
      console.error('验证author_status字段时出错:', error);
      return false;
    }
  }

  /**
   * 创建author_status字段（如果不存在）
   */
  async createAuthorStatusField(): Promise<boolean> {
    try {
      await db.query(`
        ALTER TABLE tiktok_videos_raw 
        ADD COLUMN IF NOT EXISTS author_status VARCHAR(20)
      `);
      
      console.log('✅ author_status字段创建成功');
      return true;
    } catch (error) {
      console.error('创建author_status字段失败:', error);
      return false;
    }
  }

  /**
   * 验证和创建数据溯源追踪字段
   */
  async setupTrackingFields(): Promise<boolean> {
    try {
      console.log('🔍 验证和创建数据溯源追踪字段（包含删除标记字段）...');

      // 检查需要添加的字段
      const fieldsToCheck = [
        { name: 'classification_source', type: 'varchar(20)', defaultValue: "'import'" },
        { name: 'classification_time', type: 'timestamp', defaultValue: null },
        { name: 'last_import_time', type: 'timestamp', defaultValue: 'CURRENT_TIMESTAMP' },
        { name: 'manual_classified', type: 'boolean', defaultValue: 'FALSE' },
        { name: 'deleted_at', type: 'timestamp', defaultValue: null }
      ];

      for (const field of fieldsToCheck) {
        const exists = await this.checkFieldExists('tiktok_videos_raw', field.name);
        
        if (!exists) {
          console.log(`📝 添加字段: ${field.name} (${field.type})`);
          
          let sql = `ALTER TABLE tiktok_videos_raw ADD COLUMN ${field.name} ${field.type}`;
          if (field.defaultValue) {
            sql += ` DEFAULT ${field.defaultValue}`;
          }
          
          await db.query(sql);
          console.log(`✅ 字段 ${field.name} 创建成功`);
        } else {
          console.log(`✅ 字段 ${field.name} 已存在`);
        }
      }

      return true;
    } catch (error) {
      console.error('创建数据溯源追踪字段失败:', error);
      return false;
    }
  }

  /**
   * 检查字段是否存在
   */
  async checkFieldExists(tableName: string, fieldName: string): Promise<boolean> {
    try {
      const result = await db.query(`
        SELECT column_name
        FROM information_schema.columns 
        WHERE table_name = $1 
        AND column_name = $2
      `, [tableName, fieldName]);
      
      return result.rows.length > 0;
    } catch (error) {
      console.error(`检查字段 ${fieldName} 时出错:`, error);
      return false;
    }
  }

  /**
   * 检查索引是否存在
   */
  async checkIndexExists(indexName: string): Promise<boolean> {
    try {
      const result = await db.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'tiktok_videos_raw'
        AND indexname = $1
      `, [indexName]);
      
      return result.rows.length > 0;
    } catch (error) {
      console.error(`检查索引 ${indexName} 时出错:`, error);
      return false;
    }
  }

  /**
   * 创建必要的索引
   */
  async createIndexes(): Promise<void> {
    const indexes = [
      {
        name: 'idx_tiktok_author',
        sql: 'CREATE INDEX IF NOT EXISTS idx_tiktok_author ON tiktok_videos_raw(author)',
        description: 'author字段索引（用于账号去重和查询）'
      },
      {
        name: 'idx_tiktok_author_status',
        sql: 'CREATE INDEX IF NOT EXISTS idx_tiktok_author_status ON tiktok_videos_raw(author_status)',
        description: 'author_status字段索引（用于状态筛选）'
      },
      {
        name: 'idx_tiktok_author_status_created',
        sql: 'CREATE INDEX IF NOT EXISTS idx_tiktok_author_status_created ON tiktok_videos_raw(author, author_status, created_at)',
        description: '复合索引（用于复杂查询优化）'
      },
      {
        name: 'idx_tiktok_created_at',
        sql: 'CREATE INDEX IF NOT EXISTS idx_tiktok_created_at ON tiktok_videos_raw(created_at)',
        description: 'created_at字段索引（用于时间排序）'
      },
      {
        name: 'idx_classification_tracking',
        sql: 'CREATE INDEX IF NOT EXISTS idx_classification_tracking ON tiktok_videos_raw(author, classification_source, manual_classified)',
        description: '数据溯源追踪复合索引（用于冲突检测优化）'
      },
      {
        name: 'idx_classification_time',
        sql: 'CREATE INDEX IF NOT EXISTS idx_classification_time ON tiktok_videos_raw(classification_time) WHERE classification_time IS NOT NULL',
        description: '分类时间索引（用于审计查询）'
      },
      {
        name: 'idx_manual_classified',
        sql: 'CREATE INDEX IF NOT EXISTS idx_manual_classified ON tiktok_videos_raw(manual_classified) WHERE manual_classified = TRUE',
        description: '手动分类标识索引（用于快速查找手动分类账号）'
      },
      {
        name: 'idx_last_import_time',
        sql: 'CREATE INDEX IF NOT EXISTS idx_last_import_time ON tiktok_videos_raw(last_import_time)',
        description: '最后导入时间索引（用于时间范围查询）'
      }
    ];

    for (const index of indexes) {
      try {
        const exists = await this.checkIndexExists(index.name);
        
        if (exists) {
          console.log(`✅ 索引 ${index.name} 已存在`);
          continue;
        }

        console.log(`📊 创建索引: ${index.name}`);
        console.log(`   描述: ${index.description}`);
        
        await db.query(index.sql);
        console.log(`✅ 索引 ${index.name} 创建成功`);
        
      } catch (error) {
        console.error(`❌ 创建索引 ${index.name} 失败:`, error);
        throw error;
      }
    }
  }

  /**
   * 测试查询性能
   */
  async testQueryPerformance(): Promise<void> {
    console.log('🔍 测试数据库查询性能...');
    
    const queries = [
      {
        name: '账号去重查询',
        sql: `
          SELECT DISTINCT author, COUNT(*) as works_count
          FROM tiktok_videos_raw 
          WHERE author IS NOT NULL
          GROUP BY author
          LIMIT 10
        `
      },
      {
        name: '按状态筛选查询',
        sql: `
          SELECT author_status, COUNT(*) as count
          FROM tiktok_videos_raw 
          GROUP BY author_status
        `
      },
      {
        name: '复合条件查询',
        sql: `
          SELECT author, author_status, COUNT(*) as works_count,
                 AVG(play_count) as avg_plays,
                 MAX(created_at) as latest_update
          FROM tiktok_videos_raw 
          WHERE author IS NOT NULL
          GROUP BY author, author_status
          ORDER BY works_count DESC
          LIMIT 5
        `
      }
    ];

    for (const query of queries) {
      try {
        const startTime = Date.now();
        const result = await db.query(query.sql);
        const duration = Date.now() - startTime;
        
        console.log(`✅ ${query.name}: ${duration}ms (${result.rows.length} 行)`);
        
        if (result.rows.length > 0 && result.rows.length <= 5) {
          console.log('   示例结果:', result.rows[0]);
        }
        
      } catch (error) {
        console.error(`❌ ${query.name} 查询失败:`, error);
      }
    }
  }

  /**
   * 获取表统计信息
   */
  async getTableStats(): Promise<void> {
    try {
      // 基础统计
      const totalRows = await db.query('SELECT COUNT(*) as total FROM tiktok_videos_raw');
      const uniqueAuthors = await db.query('SELECT COUNT(DISTINCT author) as unique_authors FROM tiktok_videos_raw WHERE author IS NOT NULL');
      const statusDistribution = await db.query(`
        SELECT 
          COALESCE(author_status, '未分类') as status,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
        FROM tiktok_videos_raw 
        GROUP BY author_status
        ORDER BY count DESC
      `);

      // 数据溯源统计
      const classificationSourceStats = await db.query(`
        SELECT 
          COALESCE(classification_source, '未设置') as source,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
        FROM tiktok_videos_raw 
        GROUP BY classification_source
        ORDER BY count DESC
      `);

      const manualClassifiedStats = await db.query(`
        SELECT 
          CASE 
            WHEN manual_classified = TRUE THEN '手动分类'
            WHEN manual_classified = FALSE THEN '自动导入'
            ELSE '未设置'
          END as type,
          COUNT(*) as count
        FROM tiktok_videos_raw 
        GROUP BY manual_classified
        ORDER BY manual_classified DESC NULLS LAST
      `);

      console.log('📊 数据库统计信息:');
      console.log(`   总记录数: ${totalRows.rows[0].total}`);
      console.log(`   唯一账号数: ${uniqueAuthors.rows[0].unique_authors}`);
      console.log('   状态分布:');
      
      statusDistribution.rows.forEach(row => {
        console.log(`     ${row.status}: ${row.count} (${row.percentage}%)`);
      });

      console.log('   分类来源分布:');
      classificationSourceStats.rows.forEach(row => {
        console.log(`     ${row.source}: ${row.count} (${row.percentage}%)`);
      });

      console.log('   手动分类统计:');
      manualClassifiedStats.rows.forEach(row => {
        console.log(`     ${row.type}: ${row.count}`);
      });

    } catch (error) {
      console.error('获取表统计信息失败:', error);
    }
  }

  /**
   * 创建merge_operations审计表
   */
  async createMergeOperationsTable(): Promise<boolean> {
    try {
      console.log('🔍 创建merge_operations审计表...');

      // 检查表是否已存在
      const tableExists = await this.checkTableExists('merge_operations');
      
      if (tableExists) {
        console.log('✅ merge_operations表已存在');
        return true;
      }

      // 创建表
      const createTableSQL = `
        CREATE TABLE merge_operations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          strategy VARCHAR(20) NOT NULL,
          user_id VARCHAR(100),
          conflict_count INTEGER DEFAULT 0,
          affected_account_count INTEGER DEFAULT 0,
          operation_summary TEXT,
          rollback_data JSONB,
          status VARCHAR(20) DEFAULT 'completed',
          execution_time_ms INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;

      await db.query(createTableSQL);
      console.log('✅ merge_operations表创建成功');

      // 创建表相关索引
      const indexes = [
        {
          name: 'idx_merge_operations_timestamp',
          sql: 'CREATE INDEX idx_merge_operations_timestamp ON merge_operations(timestamp)',
          description: '时间戳索引（用于按时间查询操作历史）'
        },
        {
          name: 'idx_merge_operations_user',
          sql: 'CREATE INDEX idx_merge_operations_user ON merge_operations(user_id) WHERE user_id IS NOT NULL',
          description: '用户ID索引（用于查询特定用户的操作历史）'
        },
        {
          name: 'idx_merge_operations_status',
          sql: 'CREATE INDEX idx_merge_operations_status ON merge_operations(status)',
          description: '状态索引（用于查询失败或特定状态的操作）'
        },
        {
          name: 'idx_merge_operations_strategy',
          sql: 'CREATE INDEX idx_merge_operations_strategy ON merge_operations(strategy)',
          description: '策略索引（用于分析不同合并策略的使用情况）'
        }
      ];

      for (const index of indexes) {
        await db.query(index.sql);
        console.log(`✅ 索引 ${index.name} 创建成功`);
      }

      return true;
    } catch (error) {
      console.error('创建merge_operations表失败:', error);
      return false;
    }
  }

  /**
   * 检查表是否存在
   */
  async checkTableExists(tableName: string): Promise<boolean> {
    try {
      const result = await db.query(`
        SELECT table_name
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      `, [tableName]);
      
      return result.rows.length > 0;
    } catch (error) {
      console.error(`检查表 ${tableName} 时出错:`, error);
      return false;
    }
  }

  /**
   * 创建classification_audit历史表
   */
  async createClassificationAuditTable(): Promise<boolean> {
    try {
      console.log('🔍 创建classification_audit历史表...');

      // 检查表是否已存在
      const tableExists = await this.checkTableExists('classification_audit');
      
      if (tableExists) {
        console.log('✅ classification_audit表已存在');
        return true;
      }

      // 创建表
      const createTableSQL = `
        CREATE TABLE classification_audit (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          author VARCHAR(255) NOT NULL,
          old_status VARCHAR(50),
          new_status VARCHAR(50),
          classification_source VARCHAR(20) NOT NULL,
          operation_id UUID REFERENCES merge_operations(id),
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          additional_data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          -- 添加约束确保数据一致性
          CONSTRAINT check_status_change CHECK (
            old_status IS DISTINCT FROM new_status
          )
        );
      `;

      await db.query(createTableSQL);
      console.log('✅ classification_audit表创建成功');

      // 创建表相关索引
      const indexes = [
        {
          name: 'idx_classification_audit_author',
          sql: 'CREATE INDEX idx_classification_audit_author ON classification_audit(author)',
          description: 'author字段索引（用于查询特定账号的分类历史）'
        },
        {
          name: 'idx_classification_audit_timestamp',
          sql: 'CREATE INDEX idx_classification_audit_timestamp ON classification_audit(timestamp)',
          description: '时间戳索引（用于按时间查询分类变更历史）'
        },
        {
          name: 'idx_classification_audit_operation',
          sql: 'CREATE INDEX idx_classification_audit_operation ON classification_audit(operation_id) WHERE operation_id IS NOT NULL',
          description: '操作ID索引（用于关联合并操作查询）'
        },
        {
          name: 'idx_classification_audit_source',
          sql: 'CREATE INDEX idx_classification_audit_source ON classification_audit(classification_source)',
          description: '分类来源索引（用于按来源筛选变更记录）'
        },
        {
          name: 'idx_classification_audit_author_timestamp',
          sql: 'CREATE INDEX idx_classification_audit_author_timestamp ON classification_audit(author, timestamp DESC)',
          description: '复合索引（用于查询账号的分类变更时间线）'
        }
      ];

      for (const index of indexes) {
        await db.query(index.sql);
        console.log(`✅ 索引 ${index.name} 创建成功`);
      }

      // 添加表注释
      await db.query(`
        COMMENT ON TABLE classification_audit IS '分类变更审计表，记录账号状态的每次变更历史';
      `);

      await db.query(`
        COMMENT ON COLUMN classification_audit.author IS '账号名称';
      `);

      await db.query(`
        COMMENT ON COLUMN classification_audit.old_status IS '变更前的状态（成品号/半成品号/null）';
      `);

      await db.query(`
        COMMENT ON COLUMN classification_audit.new_status IS '变更后的状态（成品号/半成品号/null）';
      `);

      await db.query(`
        COMMENT ON COLUMN classification_audit.classification_source IS '分类来源（manual/import/system）';
      `);

      await db.query(`
        COMMENT ON COLUMN classification_audit.operation_id IS '关联的合并操作ID（可选）';
      `);

      await db.query(`
        COMMENT ON COLUMN classification_audit.additional_data IS '额外的上下文数据（JSON格式）';
      `);

      console.log('✅ 表注释添加完成');

      return true;
    } catch (error) {
      console.error('创建classification_audit表失败:', error);
      return false;
    }
  }

  /**
   * 验证classification_audit表结构
   */
  async verifyClassificationAuditTable(): Promise<void> {
    try {
      console.log('🔍 验证classification_audit表结构...');

      const result = await db.query(`
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'classification_audit' 
        ORDER BY ordinal_position
      `);

      if (result.rows.length === 0) {
        console.log('❌ classification_audit表不存在');
        return;
      }

      console.log('✅ classification_audit表字段结构:');
      result.rows.forEach(field => {
        console.log(`   ${field.column_name}: ${field.data_type} ${field.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${field.column_default ? `DEFAULT ${field.column_default}` : ''}`);
      });

      // 验证索引
      const indexResult = await db.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'classification_audit'
        AND schemaname = 'public'
        ORDER BY indexname
      `);

      console.log('   索引情况:');
      if (indexResult.rows.length === 0) {
        console.log('   ❌ 没有找到索引');
      } else {
        indexResult.rows.forEach(index => {
          console.log(`   ✅ ${index.indexname}`);
        });
      }

      // 验证外键约束
      const constraintResult = await db.query(`
        SELECT conname, confrelid::regclass as foreign_table, conkey, confkey
        FROM pg_constraint
        WHERE conrelid = 'classification_audit'::regclass
        AND contype = 'f'
      `);

      console.log('   外键约束:');
      if (constraintResult.rows.length === 0) {
        console.log('   ❌ 没有找到外键约束');
      } else {
        constraintResult.rows.forEach(constraint => {
          console.log(`   ✅ ${constraint.conname} -> ${constraint.foreign_table}`);
        });
      }

    } catch (error) {
      console.error('验证classification_audit表失败:', error);
    }
  }

  /**
   * 测试classification_audit表的基本功能
   */
  async testClassificationAuditTable(): Promise<void> {
    try {
      console.log('🧪 测试classification_audit表基本功能...');

      // 首先创建一个测试的merge_operations记录
      const mergeOperationResult = await db.query(`
        INSERT INTO merge_operations (
          strategy, operation_summary, status, execution_time_ms
        ) VALUES ($1, $2, $3, $4)
        RETURNING id
      `, ['protect', '测试分类审计功能', 'completed', 500]);

      const operationId = mergeOperationResult.rows[0].id;

      // 测试分类变更记录
      const testAuditRecords = [
        {
          author: 'test_author_1',
          old_status: null,
          new_status: '成品号',
          classification_source: 'manual',
          operation_id: operationId,
          additional_data: JSON.stringify({
            user_action: 'manual_classification',
            reason: '用户手动标记为成品号',
            confidence: 'high'
          })
        },
        {
          author: 'test_author_2',
          old_status: '半成品号',
          new_status: '成品号',
          classification_source: 'manual',
          operation_id: operationId,
          additional_data: JSON.stringify({
            user_action: 'status_update',
            reason: '审核后升级为成品号'
          })
        },
        {
          author: 'test_author_3',
          old_status: '成品号',
          new_status: null,
          classification_source: 'system',
          operation_id: null,
          additional_data: JSON.stringify({
            system_action: 'auto_reset',
            reason: '账号已停用，重置状态'
          })
        }
      ];

      // 批量插入测试记录
      const insertedIds = [];
      for (const record of testAuditRecords) {
        const insertResult = await db.query(`
          INSERT INTO classification_audit (
            author, old_status, new_status, classification_source, 
            operation_id, additional_data
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, timestamp
        `, [
          record.author,
          record.old_status,
          record.new_status,
          record.classification_source,
          record.operation_id,
          record.additional_data
        ]);

        insertedIds.push(insertResult.rows[0].id);
        console.log(`✅ 测试记录插入成功: ${record.author} ${record.old_status} → ${record.new_status}`);
      }

      // 测试查询功能
      console.log('🔍 测试查询功能...');

      // 按账号查询历史
      const authorHistoryResult = await db.query(`
        SELECT author, old_status, new_status, classification_source, timestamp
        FROM classification_audit 
        WHERE author = $1
        ORDER BY timestamp DESC
      `, ['test_author_1']);

      if (authorHistoryResult.rows.length > 0) {
        console.log(`✅ 账号历史查询成功，找到 ${authorHistoryResult.rows.length} 条记录`);
      }

      // 按操作ID查询相关变更
      const operationAuditResult = await db.query(`
        SELECT COUNT(*) as count, 
               COUNT(CASE WHEN old_status IS NULL THEN 1 END) as new_classifications,
               COUNT(CASE WHEN old_status IS NOT NULL THEN 1 END) as status_changes
        FROM classification_audit 
        WHERE operation_id = $1
      `, [operationId]);

      if (operationAuditResult.rows.length > 0) {
        const stats = operationAuditResult.rows[0];
        console.log(`✅ 操作审计查询成功: 总计${stats.count}项变更，${stats.new_classifications}个新分类，${stats.status_changes}个状态更改`);
      }

      // 测试JSON字段查询
      const jsonQueryResult = await db.query(`
        SELECT author, additional_data->>'reason' as reason
        FROM classification_audit 
        WHERE additional_data->>'user_action' = 'manual_classification'
      `);

      if (jsonQueryResult.rows.length > 0) {
        console.log(`✅ JSON字段查询成功: ${jsonQueryResult.rows[0].reason}`);
      }

      // 清理测试数据
      for (const id of insertedIds) {
        await db.query('DELETE FROM classification_audit WHERE id = $1', [id]);
      }
      await db.query('DELETE FROM merge_operations WHERE id = $1', [operationId]);
      console.log('✅ 测试数据清理完成');

    } catch (error) {
      console.error('classification_audit表功能测试失败:', error);
    }
  }

  /**
   * 测试merge_operations表的基本功能
   */
  async testMergeOperationsTable(): Promise<void> {
    try {
      console.log('🧪 测试merge_operations表基本功能...');

      // 测试插入操作
      const testOperation = {
        strategy: 'protect',
        user_id: 'test_user',
        conflict_count: 5,
        affected_account_count: 3,
        operation_summary: '测试合并操作：保护现有分类，更新统计数据',
        rollback_data: JSON.stringify({
          affectedAccounts: ['test_author_1', 'test_author_2'],
          originalStates: [
            { author: 'test_author_1', old_status: '成品号' },
            { author: 'test_author_2', old_status: null }
          ]
        }),
        status: 'completed',
        execution_time_ms: 1250
      };

      // 插入测试记录
      const insertResult = await db.query(`
        INSERT INTO merge_operations (
          strategy, user_id, conflict_count, affected_account_count, 
          operation_summary, rollback_data, status, execution_time_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, timestamp
      `, [
        testOperation.strategy,
        testOperation.user_id,
        testOperation.conflict_count,
        testOperation.affected_account_count,
        testOperation.operation_summary,
        testOperation.rollback_data,
        testOperation.status,
        testOperation.execution_time_ms
      ]);

      if (insertResult.rows.length > 0) {
        const insertedRecord = insertResult.rows[0];
        console.log(`✅ 测试记录插入成功 ID: ${insertedRecord.id}`);

        // 测试查询操作
        const queryResult = await db.query(`
          SELECT * FROM merge_operations 
          WHERE id = $1
        `, [insertedRecord.id]);

        if (queryResult.rows.length > 0) {
          const record = queryResult.rows[0];
          console.log('✅ 查询测试通过，记录详情:');
          console.log(`   策略: ${record.strategy}`);
          console.log(`   冲突数: ${record.conflict_count}`);
          console.log(`   影响账号数: ${record.affected_account_count}`);
          console.log(`   状态: ${record.status}`);
          console.log(`   执行时间: ${record.execution_time_ms}ms`);

          // 测试JSON字段解析
          const rollbackData = record.rollback_data; // PostgreSQL返回的JSONB已经是对象
          console.log(`   回滚数据: 包含${rollbackData.affectedAccounts.length}个账号`);
        } else {
          console.log('❌ 查询测试失败：无法找到刚插入的记录');
        }

        // 清理测试数据
        await db.query('DELETE FROM merge_operations WHERE id = $1', [insertedRecord.id]);
        console.log('✅ 测试数据清理完成');
      } else {
        console.log('❌ 插入测试失败：无法创建测试记录');
      }

      // 测试索引性能
      const indexTestResult = await db.query(`
        SELECT COUNT(*) as total FROM merge_operations 
        WHERE strategy = 'protect' 
        AND status = 'completed'
        AND timestamp > CURRENT_TIMESTAMP - INTERVAL '1 day'
      `);

      console.log(`✅ 索引查询测试完成，当前表中有 ${indexTestResult.rows[0].total} 条相关记录`);

    } catch (error) {
      console.error('merge_operations表功能测试失败:', error);
    }
  }

  /**
   * 验证merge_operations表结构
   */
  async verifyMergeOperationsTable(): Promise<void> {
    try {
      console.log('🔍 验证merge_operations表结构...');

      const result = await db.query(`
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'merge_operations' 
        ORDER BY ordinal_position
      `);

      if (result.rows.length === 0) {
        console.log('❌ merge_operations表不存在');
        return;
      }

      console.log('✅ merge_operations表字段结构:');
      result.rows.forEach(field => {
        console.log(`   ${field.column_name}: ${field.data_type} ${field.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${field.column_default ? `DEFAULT ${field.column_default}` : ''}`);
      });

      // 验证索引
      const indexResult = await db.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'merge_operations'
        AND schemaname = 'public'
        ORDER BY indexname
      `);

      console.log('   索引情况:');
      if (indexResult.rows.length === 0) {
        console.log('   ❌ 没有找到索引');
      } else {
        indexResult.rows.forEach(index => {
          console.log(`   ✅ ${index.indexname}`);
        });
      }

    } catch (error) {
      console.error('验证merge_operations表失败:', error);
    }
  }

  /**
   * 创建专门的性能优化索引
   */
  async createPerformanceOptimizedIndexes(): Promise<boolean> {
    try {
      console.log('🚀 创建性能优化索引...');

      // 针对冲突检测优化的专用索引
      const conflictDetectionIndexes = [
        {
          name: 'idx_conflict_detection_manual',
          sql: `CREATE INDEX IF NOT EXISTS idx_conflict_detection_manual 
                ON tiktok_videos_raw(author, manual_classified, author_status) 
                WHERE manual_classified = TRUE`,
          description: '冲突检测专用索引：快速查找手动分类的账号及其状态'
        },
        {
          name: 'idx_conflict_detection_source',
          sql: `CREATE INDEX IF NOT EXISTS idx_conflict_detection_source 
                ON tiktok_videos_raw(author, classification_source, classification_time)
                WHERE classification_source = 'manual'`,
          description: '冲突检测专用索引：按来源查找手动分类记录'
        },
        {
          name: 'idx_recent_operations',
          sql: `CREATE INDEX IF NOT EXISTS idx_recent_operations 
                ON merge_operations(timestamp DESC, status, strategy)`,
          description: '近期操作优化索引：快速查询合并操作（按时间倒序）'
        },
        {
          name: 'idx_audit_recent_changes',
          sql: `CREATE INDEX IF NOT EXISTS idx_audit_recent_changes 
                ON classification_audit(timestamp DESC, author, classification_source)`,
          description: '近期变更审计索引：快速查询分类变更（按时间倒序）'
        },
        {
          name: 'idx_batch_conflict_resolution',
          sql: `CREATE INDEX IF NOT EXISTS idx_batch_conflict_resolution 
                ON tiktok_videos_raw(author, author_status, last_import_time)
                WHERE author_status IS NOT NULL`,
          description: '批量冲突解决索引：优化批量处理时的状态查询'
        }
      ];

      for (const index of conflictDetectionIndexes) {
        try {
          const exists = await this.checkIndexExists(index.name);
          
          if (exists) {
            console.log(`✅ 性能索引 ${index.name} 已存在`);
            continue;
          }

          console.log(`🔧 创建性能索引: ${index.name}`);
          console.log(`   优化目标: ${index.description}`);
          
          await db.query(index.sql);
          console.log(`✅ 性能索引 ${index.name} 创建成功`);
          
        } catch (error) {
          console.error(`❌ 创建性能索引 ${index.name} 失败:`, error);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('创建性能优化索引失败:', error);
      return false;
    }
  }

  /**
   * 测试冲突检测性能
   */
  async testConflictDetectionPerformance(): Promise<void> {
    try {
      console.log('⚡ 测试冲突检测查询性能...');

      const performanceTests = [
        {
          name: '查找所有手动分类账号',
          sql: `
            SELECT author, author_status, classification_time
            FROM tiktok_videos_raw 
            WHERE manual_classified = TRUE
            LIMIT 100
          `,
          expectedUsage: '应使用 idx_conflict_detection_manual 索引'
        },
        {
          name: '按账号查询分类状态',
          sql: `
            SELECT author, author_status, classification_source, last_import_time
            FROM tiktok_videos_raw 
            WHERE author IN ('test1', 'test2', 'test3')
          `,
          expectedUsage: '应使用 idx_tiktok_author 索引'
        },
        {
          name: '查询近期合并操作',
          sql: `
            SELECT id, timestamp, strategy, conflict_count, affected_account_count
            FROM merge_operations 
            WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '7 days'
            ORDER BY timestamp DESC
            LIMIT 20
          `,
          expectedUsage: '应使用 idx_recent_operations 索引'
        },
        {
          name: '查询账号分类变更历史',
          sql: `
            SELECT ca.*, mo.strategy as operation_strategy
            FROM classification_audit ca
            LEFT JOIN merge_operations mo ON ca.operation_id = mo.id
            WHERE ca.author = 'sample_author'
            ORDER BY ca.timestamp DESC
            LIMIT 10
          `,
          expectedUsage: '应使用 idx_classification_audit_author_timestamp 索引'
        },
        {
          name: '统计各来源的分类数量',
          sql: `
            SELECT classification_source, COUNT(*) as count
            FROM tiktok_videos_raw 
            WHERE classification_source IS NOT NULL
            GROUP BY classification_source
          `,
          expectedUsage: '应使用分类来源相关索引'
        }
      ];

      for (const test of performanceTests) {
        try {
          console.log(`\n🔍 ${test.name}:`);
          console.log(`   ${test.expectedUsage}`);
          
          const startTime = Date.now();
          
          // 使用 EXPLAIN ANALYZE 分析查询计划
          const explainResult = await db.query(`EXPLAIN ANALYZE ${test.sql}`);
          
          const executionTime = Date.now() - startTime;
          
          console.log(`   ⏱️  执行时间: ${executionTime}ms`);
          
          // 显示查询计划的关键信息
          if (explainResult.rows.length > 0) {
            const plan = explainResult.rows.map(row => row['QUERY PLAN']).join('\n');
            
            // 检查是否使用了索引
            if (plan.includes('Index Scan') || plan.includes('Index Only Scan')) {
              console.log('   ✅ 使用了索引扫描');
              
              // 提取索引名称
              const indexMatch = plan.match(/Index.*?Scan.*?using (\w+)/);
              if (indexMatch) {
                console.log(`   📊 使用索引: ${indexMatch[1]}`);
              }
            } else if (plan.includes('Seq Scan')) {
              console.log('   ⚠️  使用了顺序扫描，可能需要优化');
            }

            // 检查执行时间
            const timeMatch = plan.match(/actual time=([\d.]+)\.\.([\d.]+)/);
            if (timeMatch) {
              const actualTime = parseFloat(timeMatch[2]);
              console.log(`   ⚡ 实际执行时间: ${actualTime.toFixed(3)}ms`);
            }
          }
          
          // 性能阈值检查
          if (executionTime > 100) {
            console.log('   ⚠️  查询时间较长，可能需要进一步优化');
          } else {
            console.log('   ✅ 性能表现良好');
          }

        } catch (error) {
          console.error(`   ❌ 测试失败: ${error.message}`);
        }
      }

      // 总体性能评估
      console.log('\n📋 性能优化建议:');
      console.log('   1. 确保所有冲突检测查询都使用了合适的索引');
      console.log('   2. 定期清理旧的审计数据以维持查询性能');
      console.log('   3. 监控慢查询并根据实际使用模式调整索引');
      console.log('   4. 考虑使用分区表来处理大量历史数据');

    } catch (error) {
      console.error('冲突检测性能测试失败:', error);
    }
  }

  /**
   * 验证索引覆盖率
   */
  async verifyIndexCoverage(): Promise<void> {
    try {
      console.log('📊 验证索引覆盖率...');

      // 检查所有表的索引情况
      const tables = ['tiktok_videos_raw', 'merge_operations', 'classification_audit'];
      
      for (const table of tables) {
        console.log(`\n🏷️  ${table} 表索引情况:`);
        
        const indexResult = await db.query(`
          SELECT 
            indexname,
            indexdef,
            CASE 
              WHEN indexdef LIKE '%UNIQUE%' THEN 'UNIQUE'
              WHEN indexdef LIKE '%WHERE%' THEN 'PARTIAL'
              ELSE 'REGULAR'
            END as index_type
          FROM pg_indexes
          WHERE tablename = $1
          AND schemaname = 'public'
          ORDER BY indexname
        `, [table]);

        if (indexResult.rows.length === 0) {
          console.log('   ❌ 没有找到索引');
        } else {
          indexResult.rows.forEach(index => {
            console.log(`   ✅ ${index.indexname} (${index.index_type})`);
          });
          console.log(`   总计: ${indexResult.rows.length} 个索引`);
        }

        // 检查表大小和索引使用统计
        const statsResult = await db.query(`
          SELECT 
            schemaname,
            tablename,
            attname as column_name,
            n_distinct,
            correlation
          FROM pg_stats 
          WHERE tablename = $1 
          AND schemaname = 'public'
          ORDER BY n_distinct DESC
        `, [table]);

        if (statsResult.rows.length > 0) {
          console.log('   📈 列统计信息（前5个最有区别性的列）:');
          statsResult.rows.slice(0, 5).forEach(stat => {
            console.log(`     ${stat.column_name}: ${stat.n_distinct} 个不同值`);
          });
        }
      }

    } catch (error) {
      console.error('验证索引覆盖率失败:', error);
    }
  }

  /**
   * 验证所有新增字段的状态
   */
  async verifyTrackingFields(): Promise<void> {
    try {
      console.log('🔍 验证数据溯源追踪字段状态...');

      const trackingFields = ['classification_source', 'classification_time', 'last_import_time', 'manual_classified', 'deleted_at'];
      
      for (const fieldName of trackingFields) {
        const result = await db.query(`
          SELECT column_name, data_type, column_default, is_nullable
          FROM information_schema.columns 
          WHERE table_name = 'tiktok_videos_raw' 
          AND column_name = $1
        `, [fieldName]);
        
        if (result.rows.length > 0) {
          const field = result.rows[0];
          console.log(`✅ ${fieldName}:`);
          console.log(`   类型: ${field.data_type}`);
          console.log(`   默认值: ${field.column_default || 'NULL'}`);
          console.log(`   允许NULL: ${field.is_nullable}`);
        } else {
          console.log(`❌ ${fieldName}: 字段不存在`);
        }
      }
    } catch (error) {
      console.error('验证追踪字段状态失败:', error);
    }
  }

  /**
   * 完整的数据库设置和验证流程
   */
  async setupDatabase(): Promise<boolean> {
    try {
      console.log('🚀 开始数据库设置和优化...\n');
      
      // 1. 验证数据库连接
      console.log('1️⃣ 验证数据库连接...');
      const connected = await db.testConnection();
      if (!connected) {
        throw new Error('数据库连接失败');
      }
      
      // 2. 验证和创建author_status字段
      console.log('\n2️⃣ 验证author_status字段...');
      const fieldExists = await this.verifyAuthorStatusField();
      if (!fieldExists) {
        const created = await this.createAuthorStatusField();
        if (!created) {
          throw new Error('author_status字段创建失败');
        }
      }

      // 2.1 创建数据溯源追踪字段
      console.log('\n2.1️⃣ 设置数据溯源追踪字段...');
      const trackingSetup = await this.setupTrackingFields();
      if (!trackingSetup) {
        throw new Error('数据溯源追踪字段创建失败');
      }

      // 2.2 创建merge_operations审计表
      console.log('\n2.2️⃣ 创建merge_operations审计表...');
      const mergeTableSetup = await this.createMergeOperationsTable();
      if (!mergeTableSetup) {
        throw new Error('merge_operations表创建失败');
      }

      // 2.3 创建classification_audit历史表
      console.log('\n2.3️⃣ 创建classification_audit历史表...');
      const auditTableSetup = await this.createClassificationAuditTable();
      if (!auditTableSetup) {
        throw new Error('classification_audit表创建失败');
      }
      
      // 3. 创建索引
      console.log('\n3️⃣ 创建数据库索引...');
      await this.createIndexes();

      // 3.1 创建性能优化索引
      console.log('\n3.1️⃣ 创建性能优化索引...');
      const performanceIndexSetup = await this.createPerformanceOptimizedIndexes();
      if (!performanceIndexSetup) {
        throw new Error('性能优化索引创建失败');
      }
      
      // 4. 测试查询性能
      console.log('\n4️⃣ 测试查询性能...');
      await this.testQueryPerformance();
      
      // 5. 验证追踪字段状态
      console.log('\n5️⃣ 验证追踪字段状态...');
      await this.verifyTrackingFields();

      // 5.1 验证merge_operations表结构
      console.log('\n5.1️⃣ 验证merge_operations表结构...');
      await this.verifyMergeOperationsTable();

      // 5.2 测试merge_operations表功能
      console.log('\n5.2️⃣ 测试merge_operations表功能...');
      await this.testMergeOperationsTable();

      // 5.3 验证classification_audit表结构
      console.log('\n5.3️⃣ 验证classification_audit表结构...');
      await this.verifyClassificationAuditTable();

      // 5.4 测试classification_audit表功能
      console.log('\n5.4️⃣ 测试classification_audit表功能...');
      await this.testClassificationAuditTable();

      // 6. 验证索引覆盖率
      console.log('\n6️⃣ 验证索引覆盖率...');
      await this.verifyIndexCoverage();

      // 7. 冲突检测性能测试
      console.log('\n7️⃣ 冲突检测性能测试...');
      await this.testConflictDetectionPerformance();

      // 8. 获取统计信息
      console.log('\n8️⃣ 获取表统计信息...');
      await this.getTableStats();
      
      console.log('\n🎉 数据库设置和优化完成！');
      console.log('\n✅ 已完成的优化项目:');
      console.log('   🗂️  扩展tiktok_videos_raw表（数据溯源追踪字段）');
      console.log('   📋 创建merge_operations审计表（操作历史记录）');
      console.log('   📑 创建classification_audit历史表（分类变更追踪）');
      console.log('   ⚡ 创建性能优化索引（冲突检测专用）');
      console.log('   🔍 验证索引覆盖率和查询性能');
      
      console.log('\n🚀 系统已准备好支持智能数据合并功能！');
      return true;
      
    } catch (error) {
      console.error('\n❌ 数据库设置失败:', error);
      return false;
    }
  }
}

// 导出单例
export const databaseSetup = new DatabaseSetup();