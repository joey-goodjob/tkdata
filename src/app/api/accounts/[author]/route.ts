// 单个账号管理API接口

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import type { ApiResponse } from '@/types';

/**
 * PUT /api/accounts/[author]
 * 更新单个账号状态
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ author: string }> }
) {
  try {
    const { author } = await params;
    const body = await request.json();
    const { status, phoneNumber } = body;

    console.log(`📝 接收账号信息更新请求: author="${author}", status="${status}", phoneNumber="${phoneNumber}"`);

    // 验证状态值
    if (status !== undefined) {
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
    }

    // 解码author参数（处理URL编码）
    const decodedAuthor = decodeURIComponent(author);

    // 检查账号是否存在
    const checkQuery = 'SELECT COUNT(*) as count FROM tiktok_videos_raw WHERE author = $1';
    const checkResult = await db.query(checkQuery, [decodedAuthor]);

    if (parseInt(checkResult.rows[0].count) === 0) {
      return NextResponse.json({
        success: false,
        message: '账号不存在',
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: `未找到账号: ${decodedAuthor}`,
          timestamp: new Date()
        }
      } as ApiResponse, { status: 404 });
    }

    // 构建动态更新SQL
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updates.push(`author_status = $${paramIndex}`);
      values.push(status || null);
      paramIndex++;
    }

    if (phoneNumber !== undefined) {
      updates.push(`phone_number = $${paramIndex}`);
      values.push(phoneNumber || null);
      paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        message: '没有要更新的字段',
        error: {
          code: 'NO_UPDATE_FIELDS',
          message: '请提供要更新的字段(status 或 phoneNumber)',
          timestamp: new Date()
        }
      } as ApiResponse, { status: 400 });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(decodedAuthor);

    const updateQuery = `
      UPDATE tiktok_videos_raw
      SET ${updates.join(', ')}
      WHERE author = $${paramIndex}
    `;

    const result = await db.query(updateQuery, values);
    const updatedRows = result.rowCount || 0;

    const response: ApiResponse = {
      success: true,
      message: `账号信息更新成功，影响 ${updatedRows} 条记录`,
      data: {
        author: decodedAuthor,
        status: status !== undefined ? (status || null) : undefined,
        phoneNumber: phoneNumber !== undefined ? (phoneNumber || null) : undefined,
        updatedRecords: updatedRows
      },
      timestamp: new Date().toISOString()
    };

    console.log(`✅ 账号信息更新成功: author="${decodedAuthor}", status="${status}", phoneNumber="${phoneNumber}", records=${updatedRows}`);
    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('❌ 更新账号状态失败:', error);

    const errorResponse: ApiResponse = {
      success: false,
      message: '更新账号状态失败',
      error: {
        code: 'ACCOUNT_UPDATE_ERROR',
        message: error instanceof Error ? error.message : '未知错误',
        timestamp: new Date()
      }
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * GET /api/accounts/[author]
 * 获取单个账号详细信息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ author: string }> }
) {
  try {
    const { author } = await params;
    const decodedAuthor = decodeURIComponent(author);

    console.log(`👤 接收账号详情请求: author="${decodedAuthor}"`);

    // 查询账号详细统计信息
    const accountQuery = `
      SELECT 
        author,
        author_status,
        COUNT(*) as works_count,
        SUM(COALESCE(play_count, 0)) as total_plays,
        SUM(COALESCE(like_count, 0)) as total_likes,
        SUM(COALESCE(comment_count, 0)) as total_comments,
        SUM(COALESCE(share_count, 0)) as total_shares,
        AVG(COALESCE(play_count, 0)) as avg_plays,
        AVG(COALESCE(like_count, 0)) as avg_likes,
        MIN(created_at) as first_upload,
        MAX(created_at) as last_upload,
        COUNT(CASE WHEN play_count >= 100000 THEN 1 END) as high_performance_works,
        COUNT(CASE WHEN play_count >= 1000000 THEN 1 END) as viral_works,
        MAX(play_count) as max_plays,
        MIN(play_count) as min_plays
      FROM tiktok_videos_raw 
      WHERE author = $1
      GROUP BY author, author_status
    `;

    const result = await db.query(accountQuery, [decodedAuthor]);

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: '账号不存在',
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: `未找到账号: ${decodedAuthor}`,
          timestamp: new Date()
        }
      } as ApiResponse, { status: 404 });
    }

    const row = result.rows[0];
    const accountDetails = {
      author: row.author,
      status: row.author_status || null,
      worksCount: parseInt(row.works_count),
      totalPlays: parseInt(row.total_plays),
      totalLikes: parseInt(row.total_likes),
      totalComments: parseInt(row.total_comments),
      totalShares: parseInt(row.total_shares),
      avgPlays: Math.round(parseFloat(row.avg_plays)),
      avgLikes: Math.round(parseFloat(row.avg_likes)),
      firstUpload: new Date(row.first_upload),
      lastUpload: new Date(row.last_upload),
      highPerformanceWorks: parseInt(row.high_performance_works),
      viralWorks: parseInt(row.viral_works),
      maxPlays: parseInt(row.max_plays),
      minPlays: parseInt(row.min_plays),
      engagementRate: parseInt(row.total_plays) > 0 
        ? parseFloat(((parseInt(row.total_likes) + parseInt(row.total_comments) + parseInt(row.total_shares)) / parseInt(row.total_plays) * 100).toFixed(2))
        : 0,
      isActive: (new Date().getTime() - new Date(row.last_upload).getTime()) < (30 * 24 * 60 * 60 * 1000)
    };

    const response: ApiResponse = {
      success: true,
      data: accountDetails,
      message: '账号详情获取成功',
      timestamp: new Date().toISOString()
    };

    console.log(`✅ 账号详情返回成功: author="${decodedAuthor}"`);
    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('❌ 获取账号详情失败:', error);

    const errorResponse: ApiResponse = {
      success: false,
      message: '获取账号详情失败',
      error: {
        code: 'ACCOUNT_DETAIL_ERROR',
        message: error instanceof Error ? error.message : '未知错误',
        timestamp: new Date()
      }
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * OPTIONS /api/accounts/[author]
 * CORS 预检请求处理
 */
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    }
  );
}