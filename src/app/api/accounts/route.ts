// 账号管理API接口

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import type { ApiResponse, Account, AccountFilters, PaginatedResponse, PaginationInfo } from '@/types';

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

    // 获取删除状态筛选
    const deletedFilter = searchParams.get('deleted') || 'active'; // active, deleted, all
    
    if (deletedFilter === 'active') {
      whereConditions.push('deleted_at IS NULL');
    } else if (deletedFilter === 'deleted') {
      whereConditions.push('deleted_at IS NOT NULL');
    }
    // 如果是 'all'，不添加删除状态条件

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
        phone_number,
        deleted_at,
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
      GROUP BY author, author_status, phone_number, deleted_at
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
      phoneNumber: row.phone_number || null,
      worksCount: parseInt(row.works_count),
      totalPlays: parseInt(row.total_plays),
      totalLikes: parseInt(row.total_likes),
      totalComments: parseInt(row.total_comments),
      totalShares: parseInt(row.total_shares),
      totalCollects: 0, // 数据库中暂无此字段，设为0
      avgPlays: Math.round(parseFloat(row.avg_plays)),
      avgLikes: Math.round(parseFloat(row.avg_likes)),
      avgComments: Math.round(parseFloat(row.total_comments) / parseInt(row.works_count)) || 0,
      fansCount: null, // 数据库中暂无此字段
      firstPublishTime: new Date(row.first_upload),
      lastPublishTime: new Date(row.last_upload),
      createdAt: new Date(row.first_upload), // 使用first_upload作为创建时间
      updatedAt: new Date(row.last_upload), // 使用last_upload作为更新时间
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
      isDeleted: !!row.deleted_at
    }));

    // 分页信息
    const totalPages = Math.ceil(total / limit);
    const paginationInfo: PaginationInfo = {
      current: page,
      total: total,
      pageSize: limit,
      totalPages: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
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