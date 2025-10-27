// 统计服务 - 负责数据统计和分析

import { db } from "./database";
import type {
  DashboardStats,
  StatusDistribution,
  TopAccount,
  AccountStatus,
  TrendData,
} from "../types";

/**
 * 统计服务类
 */
export class StatsService {
  /**
   * 获取仪表板统计数据
   * 🔄 优化：减少并行查询数量，采用部分串行方式
   */
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      console.log("📊 开始计算仪表板统计数据...");

      // 🔄 步骤1：先获取最重要的基础统计（只用一个连接）
      console.log("  → 步骤1: 获取基础统计...");
      const totalStats = await this.getTotalStats();

      // 🔄 步骤2：获取状态分布（复用上一步的连接释放后）
      console.log("  → 步骤2: 获取状态分布...");
      const statusDistribution = await this.getStatusDistribution();

      // 🔄 步骤3：并行获取剩余的两个查询（减少到2个并行）
      console.log("  → 步骤3: 并行获取top账号和性能统计...");
      const [topAccounts, performanceStats] = await Promise.all([
        this.getTopAccounts(),
        this.getPerformanceStats(),
      ]);

      const stats: DashboardStats = {
        ...totalStats,
        statusDistribution,
        topAccounts,
        ...performanceStats,
      };

      console.log("✅ 仪表板统计数据计算完成");
      return stats;
    } catch (error) {
      console.error("❌ 计算仪表板统计失败:", error);
      throw new Error(
        `统计数据计算失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 获取基础统计数据
   */
  private async getTotalStats() {
    const result = await db.query(`
      SELECT 
        COUNT(DISTINCT author) as total_accounts,
        COUNT(DISTINCT CASE WHEN author_status = '成品号' THEN author END) as finished_accounts,
        COUNT(DISTINCT CASE WHEN author_status = '半成品号' THEN author END) as semi_finished_accounts,
        COUNT(DISTINCT CASE WHEN author_status IS NULL THEN author END) as unset_accounts,
        COUNT(*) as total_works,
        COALESCE(SUM(play_count), 0) as total_plays,
        COALESCE(SUM(like_count), 0) as total_likes
      FROM tiktok_videos_raw
      WHERE author IS NOT NULL
    `);

    const row = result.rows[0];

    return {
      totalAccounts: parseInt(row.total_accounts),
      finishedAccounts: parseInt(row.finished_accounts),
      semiFinishedAccounts: parseInt(row.semi_finished_accounts),
      unsetAccounts: parseInt(row.unset_accounts),
      totalWorks: parseInt(row.total_works),
      totalPlays: parseInt(row.total_plays),
      totalLikes: parseInt(row.total_likes),
    };
  }

  /**
   * 获取性能统计数据
   */
  private async getPerformanceStats() {
    const result = await db.query(`
      SELECT 
        ROUND(AVG(works_per_account), 1) as avg_works_per_account,
        ROUND(AVG(avg_plays), 0) as avg_plays_per_work
      FROM (
        SELECT 
          author,
          COUNT(*) as works_per_account,
          AVG(COALESCE(play_count, 0)) as avg_plays
        FROM tiktok_videos_raw
        WHERE author IS NOT NULL
        GROUP BY author
      ) account_stats
    `);

    const row = result.rows[0];

    return {
      avgWorksPerAccount: parseFloat(row.avg_works_per_account) || 0,
      avgPlaysPerWork: parseInt(row.avg_plays_per_work) || 0,
    };
  }

  /**
   * 获取状态分布统计
   */
  private async getStatusDistribution(): Promise<StatusDistribution[]> {
    const result = await db.query(`
      SELECT 
        COALESCE(author_status, 'unset') as status,
        COUNT(DISTINCT author) as account_count,
        COUNT(*) as work_count,
        ROUND(AVG(COALESCE(play_count, 0)), 0) as avg_plays,
        ROUND(AVG(COALESCE(like_count, 0)), 0) as avg_likes,
        ROUND(AVG(works_per_author), 1) as avg_works
      FROM (
        SELECT 
          author,
          author_status,
          play_count,
          like_count,
          COUNT(*) OVER (PARTITION BY author) as works_per_author
        FROM tiktok_videos_raw
        WHERE author IS NOT NULL
      ) author_data
      GROUP BY COALESCE(author_status, 'unset')
      ORDER BY account_count DESC
    `);

    // 计算总账号数用于百分比计算
    const totalAccounts = result.rows.reduce(
      (sum, row) => sum + parseInt(row.account_count),
      0
    );

    const statusColors = {
      成品号: "#22C55E", // 绿色
      半成品号: "#F59E0B", // 橙色
      unset: "#6B7280", // 灰色
    };

    const statusLabels = {
      成品号: "成品号",
      半成品号: "半成品号",
      unset: "未分类",
    };

    return result.rows.map((row) => ({
      status: row.status === "unset" ? "unset" : (row.status as AccountStatus),
      label:
        statusLabels[row.status as keyof typeof statusLabels] || row.status,
      count: parseInt(row.account_count),
      percentage:
        totalAccounts > 0
          ? Math.round((parseInt(row.account_count) / totalAccounts) * 100)
          : 0,
      avgPlays: parseInt(row.avg_plays),
      avgLikes: parseInt(row.avg_likes),
      avgWorks: parseFloat(row.avg_works),
      color: statusColors[row.status as keyof typeof statusColors] || "#6B7280",
    }));
  }

  /**
   * 获取表现最好的账号
   */
  private async getTopAccounts(limit: number = 10): Promise<TopAccount[]> {
    const result = await db.query(
      `
      SELECT 
        author,
        author_status,
        COUNT(*) as works_count,
        COALESCE(SUM(play_count), 0) as total_plays,
        ROUND(AVG(COALESCE(play_count, 0)), 0) as avg_plays
      FROM tiktok_videos_raw
      WHERE author IS NOT NULL
      GROUP BY author, author_status
      ORDER BY total_plays DESC, avg_plays DESC
      LIMIT $1
    `,
      [limit]
    );

    return result.rows.map((row, index) => ({
      author: row.author,
      status: (row.author_status as AccountStatus) || null,
      worksCount: parseInt(row.works_count),
      totalPlays: parseInt(row.total_plays),
      avgPlays: parseInt(row.avg_plays),
      rank: index + 1,
    }));
  }

  /**
   * 获取趋势数据（按日期）
   */
  async getTrendData(days: number = 30): Promise<TrendData[]> {
    try {
      const result = await db.query(
        `
        SELECT 
          DATE(created_at) as date,
          COUNT(DISTINCT author) as total_accounts,
          COUNT(DISTINCT CASE WHEN author_status = '成品号' THEN author END) as finished_accounts,
          COUNT(DISTINCT CASE WHEN author_status = '半成品号' THEN author END) as semi_finished_accounts,
          COUNT(*) as new_works,
          COALESCE(SUM(play_count), 0) as total_plays
        FROM tiktok_videos_raw
        WHERE author IS NOT NULL 
        AND created_at >= CURRENT_DATE - INTERVAL '$1 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT $1
      `,
        [days]
      );

      return result.rows.map((row) => ({
        date: row.date,
        totalAccounts: parseInt(row.total_accounts),
        finishedAccounts: parseInt(row.finished_accounts),
        semiFinishedAccounts: parseInt(row.semi_finished_accounts),
        newWorks: parseInt(row.new_works),
        totalPlays: parseInt(row.total_plays),
      }));
    } catch (error) {
      console.error("获取趋势数据失败:", error);
      throw new Error(
        `趋势数据查询失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 获取账号表现排行榜
   */
  async getAccountRankings(
    sortBy:
      | "totalPlays"
      | "avgPlays"
      | "totalLikes"
      | "worksCount" = "totalPlays",
    limit: number = 50,
    publishDate?: string
  ): Promise<TopVideo[]> {
    try {
      const dateCondition = publishDate
        ? `AND DATE(publish_time) = '${publishDate}'`
        : `AND DATE(publish_time) = CURRENT_DATE - INTERVAL '1 day'`;

      const result = await db.query(
        `
        SELECT
          work_title,
          author,
          work_url,
          play_count,
          like_count,
          publish_time
        FROM tiktok_videos_raw
        WHERE
          play_count IS NOT NULL
          AND play_count > 0
          AND work_url IS NOT NULL
          ${dateCondition}
        ORDER BY play_count DESC
        LIMIT $1
      `,
        [limit]
      );

      return result.rows.map((row, index) => ({
        title: row.work_title || row.work_url,
        author: row.author,
        work_url: row.work_url,
        play_count: parseInt(row.play_count),
        like_count: parseInt(row.like_count),
        publish_time: row.publish_time,
        rank: index + 1,
      }));
    } catch (error) {
      console.error("获取TOP5视频排行榜失败:", error);
      throw new Error(
        `TOP5视频排行榜查询失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 获取特定状态的账号统计
   */
  async getStatusStats(status: AccountStatus | "unset" | "all" = "all") {
    try {
      let whereClause = "WHERE author IS NOT NULL";
      const params: any[] = [];

      if (status !== "all") {
        if (status === "unset") {
          whereClause += " AND author_status IS NULL";
        } else {
          whereClause += " AND author_status = $1";
          params.push(status);
        }
      }

      const result = await db.query(
        `
        SELECT 
          COUNT(DISTINCT author) as account_count,
          COUNT(*) as work_count,
          COALESCE(SUM(play_count), 0) as total_plays,
          COALESCE(SUM(like_count), 0) as total_likes,
          COALESCE(SUM(comment_count), 0) as total_comments,
          COALESCE(SUM(share_count), 0) as total_shares,
          ROUND(AVG(COALESCE(play_count, 0)), 0) as avg_plays,
          ROUND(AVG(COALESCE(like_count, 0)), 0) as avg_likes,
          MAX(play_count) as max_plays,
          MIN(play_count) as min_plays
        FROM tiktok_videos_raw
        ${whereClause}
      `,
        params
      );

      return result.rows[0];
    } catch (error) {
      console.error("获取状态统计失败:", error);
      throw new Error(
        `状态统计查询失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 获取性能分析数据
   */
  async getPerformanceAnalysis() {
    try {
      // 各状态账号的平均表现对比
      const performanceComparison = await db.query(`
        SELECT 
          COALESCE(author_status, '未分类') as status,
          COUNT(DISTINCT author) as account_count,
          ROUND(AVG(works_per_author), 1) as avg_works_per_account,
          ROUND(AVG(avg_plays_per_author), 0) as avg_plays_per_account,
          ROUND(AVG(avg_likes_per_author), 0) as avg_likes_per_account,
          ROUND(AVG(total_plays_per_author), 0) as total_plays_per_account
        FROM (
          SELECT 
            author,
            author_status,
            COUNT(*) as works_per_author,
            AVG(COALESCE(play_count, 0)) as avg_plays_per_author,
            AVG(COALESCE(like_count, 0)) as avg_likes_per_author,
            SUM(COALESCE(play_count, 0)) as total_plays_per_author
          FROM tiktok_videos_raw
          WHERE author IS NOT NULL
          GROUP BY author, author_status
        ) author_performance
        GROUP BY COALESCE(author_status, '未分类')
        ORDER BY avg_plays_per_account DESC
      `);

      // 播放量分布统计
      const playCountDistribution = await db.query(`
        SELECT 
          play_range,
          work_count,
          sort_order,
          ROUND(work_count * 100.0 / SUM(work_count) OVER (), 2) as percentage
        FROM (
          SELECT 
            CASE 
              WHEN COALESCE(play_count, 0) = 0 THEN '0'
              WHEN COALESCE(play_count, 0) < 1000 THEN '1-999'
              WHEN COALESCE(play_count, 0) < 10000 THEN '1K-9.9K'
              WHEN COALESCE(play_count, 0) < 100000 THEN '10K-99.9K'
              WHEN COALESCE(play_count, 0) < 1000000 THEN '100K-999.9K'
              ELSE '1M+'
            END as play_range,
            COUNT(*) as work_count,
            CASE 
              WHEN COALESCE(play_count, 0) = 0 THEN 0
              WHEN COALESCE(play_count, 0) < 1000 THEN 1
              WHEN COALESCE(play_count, 0) < 10000 THEN 2
              WHEN COALESCE(play_count, 0) < 100000 THEN 3
              WHEN COALESCE(play_count, 0) < 1000000 THEN 4
              ELSE 5
            END as sort_order
          FROM tiktok_videos_raw
          WHERE author IS NOT NULL
          GROUP BY 
            CASE 
              WHEN COALESCE(play_count, 0) = 0 THEN '0'
              WHEN COALESCE(play_count, 0) < 1000 THEN '1-999'
              WHEN COALESCE(play_count, 0) < 10000 THEN '1K-9.9K'
              WHEN COALESCE(play_count, 0) < 100000 THEN '10K-99.9K'
              WHEN COALESCE(play_count, 0) < 1000000 THEN '100K-999.9K'
              ELSE '1M+'
            END,
            CASE 
              WHEN COALESCE(play_count, 0) = 0 THEN 0
              WHEN COALESCE(play_count, 0) < 1000 THEN 1
              WHEN COALESCE(play_count, 0) < 10000 THEN 2
              WHEN COALESCE(play_count, 0) < 100000 THEN 3
              WHEN COALESCE(play_count, 0) < 1000000 THEN 4
              ELSE 5
            END
        ) distribution_stats
        ORDER BY sort_order
      `);

      return {
        performanceComparison: performanceComparison.rows,
        playCountDistribution: playCountDistribution.rows,
      };
    } catch (error) {
      console.error("获取性能分析失败:", error);
      throw new Error(
        `性能分析查询失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

// 导出单例实例
export const statsService = new StatsService();
