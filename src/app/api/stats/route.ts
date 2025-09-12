// 统计数据API接口

import { NextRequest, NextResponse } from 'next/server';
import { statsService } from '@/lib/statsService';
import type { ApiResponse, DashboardStats } from '@/types';

/**
 * GET /api/stats
 * 获取仪表板统计数据
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'dashboard';

    console.log(`📊 接收统计数据请求: type=${type}`);

    let data: any;

    switch (type) {
      case 'dashboard':
        data = await statsService.getDashboardStats();
        break;
        
      case 'trends':
        const days = parseInt(searchParams.get('days') || '30');
        data = await statsService.getTrendData(days);
        break;
        
      case 'rankings':
        const sortBy = (searchParams.get('sortBy') as any) || 'totalPlays';
        const limit = parseInt(searchParams.get('limit') || '50');
        data = await statsService.getAccountRankings(sortBy, limit);
        break;
        
      case 'performance':
        data = await statsService.getPerformanceAnalysis();
        break;
        
      case 'status':
        const status = (searchParams.get('status') as any) || 'all';
        data = await statsService.getStatusStats(status);
        break;
        
      default:
        return NextResponse.json({
          success: false,
          message: `不支持的统计类型: ${type}`,
          error: {
            code: 'INVALID_STATS_TYPE',
            message: '支持的类型: dashboard, trends, rankings, performance, status',
            timestamp: new Date()
          }
        } as ApiResponse, { status: 400 });
    }

    const response: ApiResponse<any> = {
      success: true,
      data,
      message: '统计数据获取成功',
      timestamp: new Date().toISOString()
    };

    console.log(`✅ 统计数据返回成功: type=${type}`);
    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('❌ 获取统计数据失败:', error);

    const errorResponse: ApiResponse = {
      success: false,
      message: '获取统计数据失败',
      error: {
        code: 'STATS_FETCH_ERROR',
        message: error instanceof Error ? error.message : '未知错误',
        timestamp: new Date()
      }
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * OPTIONS /api/stats
 * CORS 预检请求处理
 */
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    }
  );
}