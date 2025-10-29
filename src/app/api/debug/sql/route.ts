import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

// 支持的表名和白名单查询
const ALLOWED_TABLES = ['tiktok_videos_raw', 'accounts', 'videos', 'top_videos'];
const DANGEROUS_KEYWORDS = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE'];

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: { message: 'SQL 查询不能为空' } },
        { status: 400 }
      );
    }

    // 安全检查
    const upperQuery = query.toUpperCase();

    // 检查危险关键词
    for (const keyword of DANGEROUS_KEYWORDS) {
      if (upperQuery.includes(keyword)) {
        return NextResponse.json(
          { success: false, error: { message: `不允许使用 ${keyword} 操作` } },
          { status: 403 }
        );
      }
    }

    // 检查是否只包含允许的表
    const hasAllowedTable = ALLOWED_TABLES.some(table =>
      upperQuery.includes(table.toUpperCase())
    );

    if (!hasAllowedTable && !upperQuery.includes('SELECT')) {
      return NextResponse.json(
        { success: false, error: { message: '只能查询允许的表: tiktok_videos_raw, accounts, videos, top_videos' } },
        { status: 403 }
      );
    }

    console.log('🔍 [Debug SQL] 执行查询:', query);

    const startTime = Date.now();
    const result = await db.query(query);
    const endTime = Date.now();

    console.log(`✅ [Debug SQL] 查询完成，耗时: ${endTime - startTime}ms`);

    return NextResponse.json({
      success: true,
      data: {
        result: result.rows,
        executionTime: endTime - startTime,
        query,
        rowCount: result.rows.length
      }
    });

  } catch (error) {
    console.error('❌ [Debug SQL] 查询失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : '查询执行失败'
        }
      },
      { status: 500 }
    );
  }
}

// 支持的预设查询
export async function GET() {
  const presetQueries = [
    {
      name: 'tiktok_videos_raw 表统计',
      query: `SELECT COUNT(*) as total_count FROM tiktok_videos_raw`,
      description: '查询 tiktok_videos_raw 表的总记录数'
    },
    {
      name: '账号统计',
      query: `SELECT
  COUNT(DISTINCT author) as unique_authors,
  COUNT(*) as total_videos,
  COUNT(DISTINCT CASE WHEN author_status = '成品号' THEN author END) as finished_accounts,
  COUNT(DISTINCT CASE WHEN author_status = '半成品号' THEN author END) as semi_finished_accounts
FROM tiktok_videos_raw
WHERE author IS NOT NULL`,
      description: '统计账号数量和状态分布'
    },
    {
      name: '播放量最高的视频',
      query: `SELECT author, work_title, play_count, like_count, publish_time
FROM tiktok_videos_raw
WHERE play_count IS NOT NULL AND play_count > 0
ORDER BY play_count DESC
LIMIT 10`,
      description: '查看播放量最高的10个视频'
    },
    {
      name: '今日发布视频',
      query: `SELECT COUNT(*) as today_videos
FROM tiktok_videos_raw
WHERE DATE(publish_time) = CURRENT_DATE`,
      description: '查看今天发布的视频数量'
    },
    {
      name: '最近7天数据统计',
      query: `SELECT
  DATE(publish_time) as date,
  COUNT(*) as video_count,
  COUNT(DISTINCT author) as author_count,
  SUM(play_count) as total_plays
FROM tiktok_videos_raw
WHERE publish_time >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(publish_time)
ORDER BY date DESC`,
      description: '最近7天的数据统计'
    }
  ];

  return NextResponse.json({
    success: true,
    data: presetQueries
  });
}