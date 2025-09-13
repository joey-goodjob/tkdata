import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import type { ApiResponse } from '@/types';

interface DailyChartData {
  date: string;
  accountsAbove100k: number;  // 十万播账号数
  accountsAbove1k: number;    // 千播账号数  
  totalPlays: number;         // 日总播放量
}

interface DailyVideoCountData {
  date: string;
  videoCount: number;         // 每日发布视频数量
}

interface ChartData {
  finishedAccounts: DailyChartData[];
  semiFinishedAccounts: DailyChartData[];
  finishedVideoCounts: DailyVideoCountData[];     // 成品账号每日视频数
  semiFinishedVideoCounts: DailyVideoCountData[]; // 半成品账号每日视频数
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    
    console.log(`📈 获取dashboard图表数据请求，天数: ${days}`);

    // 并行查询成品账号和半成品账号的数据（包括视频数量统计）
    const [
      finishedAccountsResult, 
      semiFinishedAccountsResult,
      finishedVideoCountsResult,
      semiFinishedVideoCountsResult
    ] = await Promise.all([
      // 成品账号数据
      db.query(`
        WITH daily_stats AS (
          SELECT 
            author,
            DATE(publish_time) as date,
            SUM(COALESCE(play_count, 0)) as author_daily_plays
          FROM tiktok_videos_raw 
          WHERE deleted_at IS NULL
            AND author IS NOT NULL
            AND author_status = '成品号'
            AND publish_time >= CURRENT_DATE - INTERVAL '${days} days'
          GROUP BY author, DATE(publish_time)
        )
        SELECT 
          date,
          COUNT(CASE WHEN author_daily_plays >= 100000 THEN 1 END) as accounts_above_100k,
          COUNT(CASE WHEN author_daily_plays >= 1000 THEN 1 END) as accounts_above_1k,
          SUM(author_daily_plays) as total_plays
        FROM daily_stats
        GROUP BY date
        ORDER BY date
      `),
      
      // 半成品账号数据
      db.query(`
        WITH daily_stats AS (
          SELECT 
            author,
            DATE(publish_time) as date,
            SUM(COALESCE(play_count, 0)) as author_daily_plays
          FROM tiktok_videos_raw 
          WHERE deleted_at IS NULL
            AND author IS NOT NULL
            AND author_status = '半成品号'
            AND publish_time >= CURRENT_DATE - INTERVAL '${days} days'
          GROUP BY author, DATE(publish_time)
        )
        SELECT 
          date,
          COUNT(CASE WHEN author_daily_plays >= 100000 THEN 1 END) as accounts_above_100k,
          COUNT(CASE WHEN author_daily_plays >= 1000 THEN 1 END) as accounts_above_1k,
          SUM(author_daily_plays) as total_plays
        FROM daily_stats
        GROUP BY date
        ORDER BY date
      `),
      
      // 成品账号每日视频数量统计
      db.query(`
        SELECT 
          DATE(publish_time) as date,
          COUNT(*) as video_count
        FROM tiktok_videos_raw 
        WHERE deleted_at IS NULL
          AND author IS NOT NULL
          AND author_status = '成品号'
          AND publish_time >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(publish_time)
        ORDER BY date
      `),
      
      // 半成品账号每日视频数量统计
      db.query(`
        SELECT 
          DATE(publish_time) as date,
          COUNT(*) as video_count
        FROM tiktok_videos_raw 
        WHERE deleted_at IS NULL
          AND author IS NOT NULL
          AND author_status = '半成品号'
          AND publish_time >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(publish_time)
        ORDER BY date
      `)
    ]);

    // 生成完整的日期序列（确保7天都有数据）
    const generateDateRange = (days: number): string[] => {
      const dates = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
      }
      return dates;
    };

    const dateRange = generateDateRange(days);

    // 处理成品账号数据
    const finishedAccountsMap = new Map(
      finishedAccountsResult.rows.map(row => [
        row.date.toISOString().split('T')[0],
        {
          accountsAbove100k: parseInt(row.accounts_above_100k) || 0,
          accountsAbove1k: parseInt(row.accounts_above_1k) || 0,
          totalPlays: parseInt(row.total_plays) || 0
        }
      ])
    );

    // 处理半成品账号数据
    const semiFinishedAccountsMap = new Map(
      semiFinishedAccountsResult.rows.map(row => [
        row.date.toISOString().split('T')[0],
        {
          accountsAbove100k: parseInt(row.accounts_above_100k) || 0,
          accountsAbove1k: parseInt(row.accounts_above_1k) || 0,
          totalPlays: parseInt(row.total_plays) || 0
        }
      ])
    );

    // 处理成品账号视频数量数据
    const finishedVideoCountsMap = new Map(
      finishedVideoCountsResult.rows.map(row => [
        row.date.toISOString().split('T')[0],
        parseInt(row.video_count) || 0
      ])
    );

    // 处理半成品账号视频数量数据
    const semiFinishedVideoCountsMap = new Map(
      semiFinishedVideoCountsResult.rows.map(row => [
        row.date.toISOString().split('T')[0],
        parseInt(row.video_count) || 0
      ])
    );

    // 填充完整的日期序列
    const finishedAccounts: DailyChartData[] = dateRange.map(date => ({
      date,
      accountsAbove100k: finishedAccountsMap.get(date)?.accountsAbove100k || 0,
      accountsAbove1k: finishedAccountsMap.get(date)?.accountsAbove1k || 0,
      totalPlays: finishedAccountsMap.get(date)?.totalPlays || 0
    }));

    const semiFinishedAccounts: DailyChartData[] = dateRange.map(date => ({
      date,
      accountsAbove100k: semiFinishedAccountsMap.get(date)?.accountsAbove100k || 0,
      accountsAbove1k: semiFinishedAccountsMap.get(date)?.accountsAbove1k || 0,
      totalPlays: semiFinishedAccountsMap.get(date)?.totalPlays || 0
    }));

    // 填充视频数量数据
    const finishedVideoCounts: DailyVideoCountData[] = dateRange.map(date => ({
      date,
      videoCount: finishedVideoCountsMap.get(date) || 0
    }));

    const semiFinishedVideoCounts: DailyVideoCountData[] = dateRange.map(date => ({
      date,
      videoCount: semiFinishedVideoCountsMap.get(date) || 0
    }));

    const chartData: ChartData = {
      finishedAccounts,
      semiFinishedAccounts,
      finishedVideoCounts,
      semiFinishedVideoCounts
    };

    console.log(`✅ 图表数据获取完成:`, {
      finishedDays: finishedAccounts.length,
      semiFinishedDays: semiFinishedAccounts.length,
      dateRange: dateRange
    });

    const response: ApiResponse<ChartData> = {
      success: true,
      data: chartData,
      message: 'dashboard图表数据获取成功',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('❌ 获取dashboard图表数据失败:', error);

    const errorResponse: ApiResponse = {
      success: false,
      message: '获取dashboard图表数据失败',
      error: {
        code: 'DASHBOARD_CHARTS_ERROR',
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