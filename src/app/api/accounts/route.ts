// 账号管理API接口

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import type { ApiResponse, Account, AccountFilters, PaginatedResponse } from '@/types';

/**
 * GET /api/accounts
 * 获取账号列表，支持搜索、筛选和分页
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 解析查询参数
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const sortBy = searchParams.get('sortBy') || 'totalPlays';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    console.log(`👥 接收账号列表请求: page=${page}, limit=${limit}, search="${search}", status=${status}, sortBy=${sortBy}`);

    const offset = (page - 1) * limit;

    // 构建WHERE条件和参数
    let whereConditions = ['author IS NOT NULL'];
    let countParams: any[] = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(`author ILIKE $${paramIndex}`);
      countParams.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      if (status === 'unclassified') {
        whereConditions.push('(author_status IS NULL OR author_status = \'\')');
      } else {
        whereConditions.push(`author_status = $${paramIndex}`);
        countParams.push(status);
        paramIndex++;
      }
    }

    const whereClause = whereConditions.join(' AND ');

    // 构建排序字段映射
    const sortFieldMap: { [key: string]: string } = {
      'author': 'author',
      'worksCount': 'works_count',
      'totalPlays': 'total_plays',
      'totalLikes': 'total_likes',
      'avgPlays': 'avg_plays',
      'lastUpload': 'last_upload'
    };

    const sortField = sortFieldMap[sortBy] || 'total_plays';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // 为查询账号列表构建完整参数数组（包含LIMIT和OFFSET）
    const queryParams = [...countParams, limit, offset];
    const limitIndex = countParams.length + 1;
    const offsetIndex = countParams.length + 2;

    // 查询账号列表数据
    const accountsQuery = `
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
        COUNT(CASE WHEN play_count >= 100000 THEN 1 END) as high_performance_works
      FROM tiktok_videos_raw 
      WHERE ${whereClause}
      GROUP BY author, author_status
      ORDER BY ${sortField} ${order}
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `;

    const accountsResult = await db.query(accountsQuery, queryParams);

    // 查询总数
    const countQuery = `
      SELECT COUNT(DISTINCT author) as total
      FROM tiktok_videos_raw 
      WHERE ${whereClause}
    `;

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    // 转换数据格式
    const accounts: Account[] = accountsResult.rows.map(row => ({
      author: row.author,
      status: row.author_status as any || null,
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
      // 计算派生字段
      engagementRate: parseInt(row.total_plays) > 0 
        ? parseFloat(((parseInt(row.total_likes) + parseInt(row.total_comments) + parseInt(row.total_shares)) / parseInt(row.total_plays) * 100).toFixed(2))
        : 0,
      isActive: (new Date().getTime() - new Date(row.last_upload).getTime()) < (30 * 24 * 60 * 60 * 1000), // 30天内有更新
      performanceScore: Math.round(
        (parseInt(row.total_plays) / 10000) * 0.4 +
        (parseInt(row.total_likes) / 1000) * 0.3 +
        (parseInt(row.works_count) / 10) * 0.3
      )
    }));

    // 分页信息
    const totalPages = Math.ceil(total / limit);
    const paginationInfo = {
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1
    };

    const response: ApiResponse<PaginatedResponse<Account>> = {
      success: true,
      data: {
        data: accounts,
        pagination: paginationInfo,
        total
      },
      message: '账号列表获取成功',
      timestamp: new Date().toISOString()
    };

    console.log(`✅ 账号列表返回成功: ${accounts.length} 个账号, 总计 ${total} 个`);
    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('❌ 获取账号列表失败:', error);

    const errorResponse: ApiResponse = {
      success: false,
      message: '获取账号列表失败',
      error: {
        code: 'ACCOUNTS_FETCH_ERROR',
        message: error instanceof Error ? error.message : '未知错误',
        timestamp: new Date()
      }
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * OPTIONS /api/accounts
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