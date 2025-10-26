import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/database";
import type { ApiResponse } from "@/types";

interface DashboardStats {
  totalAccounts: number;
  finishedAccounts: number;
  finishedThousandVideos: number; // 成品号千播放视频数
  semiFinishedThousandVideos: number; // 半成品号千播放视频数
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");

    console.log(`📊 获取dashboard统计数据请求，日期: ${dateParam || "未指定"}`);

    // 🔄 优化：串行+并行查询，减少数据库连接池压力
    // 步骤1：先查询基础的账号统计（最快的查询）
    console.log("  → 步骤1: 查询总账号数和成品账号数...");
    const [totalAccountsResult, finishedAccountsResult] = await Promise.all([
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
    ]);

    // 步骤2：查询千播放视频数据（较慢的查询）
    let finishedThousandVideosResult = { rows: [{ count: 0 }] };
    let semiFinishedThousandVideosResult = { rows: [{ count: 0 }] };

    if (dateParam) {
      console.log("  → 步骤2: 查询成品号和半成品号千播放视频数...");
      [finishedThousandVideosResult, semiFinishedThousandVideosResult] =
        await Promise.all([
          // 3. 成品号千播放视频数（指定发布日期内播放量≥1000的视频数）
          db.query(`
          SELECT COUNT(*) as count
          FROM tiktok_videos_raw
          WHERE
            -- 2. 成品号
            author_status = '成品号'
            -- 3. 用户选择的发布日期
            AND DATE(publish_time) = DATE($1)
            -- 4. 播放量破千的视频
            AND COALESCE(play_count, 0) >= 1000
        `, [dateParam]),

          // 4. 半成品号千播放视频数（指定发布日期内播放量≥1000的视频数）
          db.query(`
          SELECT COUNT(*) as count
          FROM tiktok_videos_raw
          WHERE
            -- 2. 半成品号
            author_status = '半成品号'
            -- 3. 用户选择的发布日期
            AND DATE(publish_time) = DATE($1)
            -- 4. 播放量破千的视频
            AND COALESCE(play_count, 0) >= 1000
        `, [dateParam]),
        ]);
    }

    const stats: DashboardStats = {
      totalAccounts: parseInt(String(totalAccountsResult.rows[0].count)),
      finishedAccounts: parseInt(String(finishedAccountsResult.rows[0].count)),
      finishedThousandVideos: parseInt(
        String(finishedThousandVideosResult.rows[0].count)
      ),
      semiFinishedThousandVideos: parseInt(
        String(semiFinishedThousandVideosResult.rows[0].count)
      ),
    };

    console.log(`✅ dashboard统计完成:`, {
      totalAccounts: stats.totalAccounts,
      finishedAccounts: stats.finishedAccounts,
      finishedThousandVideos: stats.finishedThousandVideos,
      semiFinishedThousandVideos: stats.semiFinishedThousandVideos,
      date: dateParam,
    });

    const response: ApiResponse<DashboardStats> = {
      success: true,
      data: stats,
      message: "dashboard统计获取成功",
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("❌ 获取dashboard统计失败:", error);

    const errorResponse: ApiResponse = {
      success: false,
      message: "获取dashboard统计失败",
      error: {
        code: "DASHBOARD_STATS_ERROR",
        message: error instanceof Error ? error.message : "未知错误",
        timestamp: new Date(),
      },
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
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  );
}
