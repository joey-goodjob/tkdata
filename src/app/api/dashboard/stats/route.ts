import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import type { ApiResponse } from '@/types';

interface DashboardStats {
  totalAccounts: number;
  finishedAccounts: number;
  finishedDailyThousand: number;
  semiFinishedDailyThousand: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    
    console.log(`📊 获取dashboard统计数据请求，日期: ${dateParam || '未指定'}`);

    // 并行查询所有统计数据
    const [
      totalAccountsResult,
      finishedAccountsResult,
      finishedDailyThousandResult,
      semiFinishedDailyThousandResult
    ] = await Promise.all([
      // 1. 总账号数
      db.query(`
        SELECT COUNT(DISTINCT author) as count
        FROM tiktok_videos_raw 
        WHERE author IS NOT NULL
      `),
      
      // 2. 成品账号数
      db.query(`
        SELECT COUNT(DISTINCT author) as count
        FROM tiktok_videos_raw 
        WHERE author IS NOT NULL
          AND author_status = '成品号'
      `),
      
      // 3. 成品日千播账号数（简化版：总播放量≥1000）
      dateParam ? db.query(`
        SELECT COUNT(DISTINCT author) as count
        FROM (
          SELECT author, SUM(COALESCE(play_count, 0)) as total_plays
          FROM tiktok_videos_raw 
          WHERE author IS NOT NULL
            AND author_status = '成品号'
          GROUP BY author
          HAVING SUM(COALESCE(play_count, 0)) >= 1000
        ) subquery
      `) : Promise.resolve({ rows: [{ count: 0 }] }),
      
      // 4. 半成品日千播账号数（简化版：总播放量≥1000）
      dateParam ? db.query(`
        SELECT COUNT(DISTINCT author) as count
        FROM (
          SELECT author, SUM(COALESCE(play_count, 0)) as total_plays
          FROM tiktok_videos_raw 
          WHERE author IS NOT NULL
            AND author_status = '半成品号'
          GROUP BY author
          HAVING SUM(COALESCE(play_count, 0)) >= 1000
        ) subquery
      `) : Promise.resolve({ rows: [{ count: 0 }] })
    ]);

    const stats: DashboardStats = {
      totalAccounts: parseInt(totalAccountsResult.rows[0].count),
      finishedAccounts: parseInt(finishedAccountsResult.rows[0].count),
      finishedDailyThousand: parseInt(finishedDailyThousandResult.rows[0].count),
      semiFinishedDailyThousand: parseInt(semiFinishedDailyThousandResult.rows[0].count)
    };

    console.log(`✅ dashboard统计完成:`, {
      totalAccounts: stats.totalAccounts,
      finishedAccounts: stats.finishedAccounts,
      finishedDailyThousand: stats.finishedDailyThousand,
      semiFinishedDailyThousand: stats.semiFinishedDailyThousand,
      date: dateParam
    });

    const response: ApiResponse<DashboardStats> = {
      success: true,
      data: stats,
      message: 'dashboard统计获取成功',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('❌ 获取dashboard统计失败:', error);

    const errorResponse: ApiResponse = {
      success: false,
      message: '获取dashboard统计失败',
      error: {
        code: 'DASHBOARD_STATS_ERROR',
        message: error instanceof Error ? error.message : '未知错误',
        timestamp: new Date()
      }
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

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