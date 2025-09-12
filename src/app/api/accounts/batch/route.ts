// 批量账号管理API接口

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import type { ApiResponse } from '@/types';

/**
 * PUT /api/accounts/batch
 * 批量更新账号状态
 */
export async function PUT(request: NextRequest) {
  try {
    const { accounts, status } = await request.json();

    console.log(`📝 接收批量账号状态更新请求: ${accounts?.length} 个账号, status="${status}"`);

    // 验证请求数据
    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return NextResponse.json({
        success: false,
        message: '账号列表不能为空',
        error: {
          code: 'INVALID_ACCOUNTS',
          message: '请提供要更新的账号列表',
          timestamp: new Date()
        }
      } as ApiResponse, { status: 400 });
    }

    // 验证状态值
    const validStatuses = ['成品号', '半成品号'];
    if (status !== null && status !== '' && !validStatuses.includes(status)) {
      return NextResponse.json({
        success: false,
        message: '无效的账号状态',
        error: {
          code: 'INVALID_STATUS',
          message: '状态必须是: 成品号, 半成品号, 或空值',
          timestamp: new Date()
        }
      } as ApiResponse, { status: 400 });
    }

    if (accounts.length > 100) {
      return NextResponse.json({
        success: false,
        message: '批量更新数量过多',
        error: {
          code: 'TOO_MANY_ACCOUNTS',
          message: '单次批量更新最多支持100个账号',
          timestamp: new Date()
        }
      } as ApiResponse, { status: 400 });
    }

    // 开启事务
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      let totalUpdatedRows = 0;
      const updateResults: { author: string; updated: number }[] = [];

      // 逐个更新账号状态
      for (const author of accounts) {
        const updateQuery = `
          UPDATE tiktok_videos_raw 
          SET author_status = $1, updated_at = CURRENT_TIMESTAMP 
          WHERE author = $2
        `;

        const result = await client.query(updateQuery, [status || null, author]);
        const updatedRows = result.rowCount || 0;
        
        totalUpdatedRows += updatedRows;
        updateResults.push({ author, updated: updatedRows });
      }

      await client.query('COMMIT');

      const response: ApiResponse = {
        success: true,
        message: `批量更新完成，共影响 ${totalUpdatedRows} 条记录`,
        data: {
          status: status || null,
          accountsCount: accounts.length,
          totalUpdatedRecords: totalUpdatedRows,
          details: updateResults
        },
        timestamp: new Date().toISOString()
      };

      console.log(`✅ 批量账号状态更新成功: ${accounts.length} 个账号, status="${status}", records=${totalUpdatedRows}`);
      return NextResponse.json(response, { status: 200 });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ 批量更新账号状态失败:', error);

    const errorResponse: ApiResponse = {
      success: false,
      message: '批量更新账号状态失败',
      error: {
        code: 'BATCH_UPDATE_ERROR',
        message: error instanceof Error ? error.message : '未知错误',
        timestamp: new Date()
      }
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * OPTIONS /api/accounts/batch
 * CORS 预检请求处理
 */
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    }
  );
}