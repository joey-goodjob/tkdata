import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/database";
import type { ApiResponse } from "@/types";

interface DashboardStats {
  totalAccounts: number;
  finishedAccounts: number;
  finishedThousandVideos: number; // 成品号千播放视频数
  semiFinishedThousandVideos: number; // 半成品号千播放视频数
  allThousandVideos: number; // 所有账号千播放视频数（不区分成品/半成品）
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
    let allThousandVideosResult = { rows: [{ count: 0 }] };

    if (dateParam) {
      console.log("  → 步骤2: 查询成品号和半成品号千播放视频数...");
      console.log(`  📅 查询日期: ${dateParam}`);

      // 先获取调试信息
      const debugInfo = await db.query(`
        SELECT
          DATE_TRUNC('day', MAX(created_at)) as latest_created_date,
          MAX(created_at) as latest_created_time,
          COUNT(*) as total_records
        FROM tiktok_videos_raw
      `);
      console.log("  🔍 调试信息:", debugInfo.rows[0]);

      // 检查符合created_at条件的记录数
      const createdAtCheck = await db.query(`
        SELECT COUNT(*) as count
        FROM tiktok_videos_raw
        WHERE
          created_at >= (
            SELECT DATE_TRUNC('day', MAX(created_at))
            FROM tiktok_videos_raw
          )
          AND created_at < (
            SELECT DATE_TRUNC('day', MAX(created_at)) + INTERVAL '1 day'
            FROM tiktok_videos_raw
          )
      `);
      console.log(`  📊 符合created_at条件的记录数: ${createdAtCheck.rows[0].count}`);

      // 检查符合publish_time条件的记录数
      const publishTimeCheck = await db.query(`
        SELECT COUNT(*) as count
        FROM tiktok_videos_raw
        WHERE
          publish_time >= $1::timestamp
          AND publish_time < ($1::timestamp + INTERVAL '1 day')
      `, [`${dateParam} 00:00:00`]);
      console.log(`  📊 符合publish_time ${dateParam} 的记录数: ${publishTimeCheck.rows[0].count}`);

      // 逐步检查筛选条件
      console.log("  🔍 开始逐步检查筛选条件...");

      // 步骤1: created_at + publish_time 组合
      const step1Check = await db.query(`
        SELECT COUNT(*) as count
        FROM tiktok_videos_raw
        WHERE
          created_at >= (
            SELECT DATE_TRUNC('day', MAX(created_at))
            FROM tiktok_videos_raw
          )
          AND created_at < (
            SELECT DATE_TRUNC('day', MAX(created_at)) + INTERVAL '1 day'
            FROM tiktok_videos_raw
          )
          AND publish_time >= $1::timestamp
          AND publish_time < ($1::timestamp + INTERVAL '1 day')
      `, [`${dateParam} 00:00:00`]);
      console.log(`  📊 步骤1 - created_at + publish_time 组合: ${step1Check.rows[0].count}`);

      // 步骤2: created_at + publish_time + author_status 组合
      const step2Check = await db.query(`
        SELECT COUNT(*) as count
        FROM tiktok_videos_raw
        WHERE
          created_at >= (
            SELECT DATE_TRUNC('day', MAX(created_at))
            FROM tiktok_videos_raw
          )
          AND created_at < (
            SELECT DATE_TRUNC('day', MAX(created_at)) + INTERVAL '1 day'
            FROM tiktok_videos_raw
          )
          AND publish_time >= $1::timestamp
          AND publish_time < ($1::timestamp + INTERVAL '1 day')
          AND author_status = '成品号'
      `, [`${dateParam} 00:00:00`]);
      console.log(`  📊 步骤2 - created_at + publish_time + author_status 组合: ${step2Check.rows[0].count}`);

      // 步骤3: created_at + publish_time + author_status + play_count 组合（最终查询）
      const step3Check = await db.query(`
        SELECT COUNT(*) as count
        FROM tiktok_videos_raw
        WHERE
          created_at >= (
            SELECT DATE_TRUNC('day', MAX(created_at))
            FROM tiktok_videos_raw
          )
          AND created_at < (
            SELECT DATE_TRUNC('day', MAX(created_at)) + INTERVAL '1 day'
            FROM tiktok_videos_raw
          )
          AND publish_time >= $1::timestamp
          AND publish_time < ($1::timestamp + INTERVAL '1 day')
          AND author_status = '成品号'
          AND COALESCE(play_count, 0) >= 1000
      `, [`${dateParam} 00:00:00`]);
      console.log(`  📊 步骤3 - 加上播放量条件后的最终结果: ${step3Check.rows[0].count}`);

      // 对比：不限制created_at的情况下
      const noCreatedAtLimitCheck = await db.query(`
        SELECT COUNT(*) as count
        FROM tiktok_videos_raw
        WHERE
          publish_time >= $1::timestamp
          AND publish_time < ($1::timestamp + INTERVAL '1 day')
          AND author_status = '成品号'
          AND COALESCE(play_count, 0) >= 1000
      `, [`${dateParam} 00:00:00`]);
      console.log(`  📊 对比 - 不限制created_at的结果: ${noCreatedAtLimitCheck.rows[0].count}`);

      [finishedThousandVideosResult, semiFinishedThousandVideosResult, allThousandVideosResult] =
        await Promise.all([
          // 3. 成品号千播放视频数（最新数据中，指定发布日期内播放量≥1000的视频数）
          (async () => {
            console.log("  🟡 开始查询成品号千播放视频数...");
            const result = await db.query(`
              SELECT COUNT(*) as count
              FROM tiktok_videos_raw
              WHERE
                -- 1. 只使用最新上传的数据（按created_at的精确时间范围）
                created_at >= (
                  SELECT DATE_TRUNC('day', MAX(created_at))
                  FROM tiktok_videos_raw
                )
                AND created_at < (
                  SELECT DATE_TRUNC('day', MAX(created_at)) + INTERVAL '1 day'
                  FROM tiktok_videos_raw
                )
                -- 2. 成品号
                AND author_status = '成品号'
                -- 3. 用户选择的发布日期（精确时间范围）
                AND publish_time >= $1::timestamp
                AND publish_time < ($1::timestamp + INTERVAL '1 day')
                -- 4. 播放量破千的视频
                AND COALESCE(play_count, 0) >= 1000
            `, [`${dateParam} 00:00:00`]);
            console.log(`  🟡 成品号查询结果: ${result.rows[0].count}`);
            return result;
          })(),

          // 4. 半成品号千播放视频数（最新数据中，指定发布日期内播放量≥1000的视频数）
          (async () => {
            console.log("  🟣 开始查询半成品号千播放视频数...");
            const result = await db.query(`
              SELECT COUNT(*) as count
              FROM tiktok_videos_raw
              WHERE
                -- 1. 只使用最新上传的数据（按created_at的精确时间范围）
                created_at >= (
                  SELECT DATE_TRUNC('day', MAX(created_at))
                  FROM tiktok_videos_raw
                )
                AND created_at < (
                  SELECT DATE_TRUNC('day', MAX(created_at)) + INTERVAL '1 day'
                  FROM tiktok_videos_raw
                )
                -- 2. 半成品号
                AND author_status = '半成品号'
                -- 3. 用户选择的发布日期（精确时间范围）
                AND publish_time >= $1::timestamp
                AND publish_time < ($1::timestamp + INTERVAL '1 day')
                -- 4. 播放量破千的视频
                AND COALESCE(play_count, 0) >= 1000
            `, [`${dateParam} 00:00:00`]);
            console.log(`  🟣 半成品号查询结果: ${result.rows[0].count}`);
            return result;
          })(),

          // 5. 所有账号千播放视频数（最新数据中，指定发布日期内播放量≥1000的视频数，不区分成品/半成品）
          (async () => {
            console.log("  🔵 开始查询所有账号千播放视频数...");
            const result = await db.query(`
              SELECT COUNT(*) as count
              FROM tiktok_videos_raw
              WHERE
                -- 1. 只使用最新上传的数据（按created_at的精确时间范围）
                created_at >= (
                  SELECT DATE_TRUNC('day', MAX(created_at))
                  FROM tiktok_videos_raw
                )
                AND created_at < (
                  SELECT DATE_TRUNC('day', MAX(created_at)) + INTERVAL '1 day'
                  FROM tiktok_videos_raw
                )
                -- 2. 用户选择的发布日期（精确时间范围）
                AND publish_time >= $1::timestamp
                AND publish_time < ($1::timestamp + INTERVAL '1 day')
                -- 3. 播放量破千的视频（不区分账号状态）
                AND COALESCE(play_count, 0) >= 1000
            `, [`${dateParam} 00:00:00`]);
            console.log(`  🔵 所有账号查询结果: ${result.rows[0].count}`);
            return result;
          })(),
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
      allThousandVideos: parseInt(
        String(allThousandVideosResult.rows[0].count)
      ),
    };

    console.log(`✅ dashboard统计完成:`, {
      totalAccounts: stats.totalAccounts,
      finishedAccounts: stats.finishedAccounts,
      finishedThousandVideos: stats.finishedThousandVideos,
      semiFinishedThousandVideos: stats.semiFinishedThousandVideos,
      allThousandVideos: stats.allThousandVideos,
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
