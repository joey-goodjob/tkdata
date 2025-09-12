// 数据导出API接口

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { statsService } from '@/lib/statsService';
import { db } from '@/lib/database';
import type { ApiResponse } from '@/types';

/**
 * GET /api/stats/export
 * 导出统计数据
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'excel'; // excel, csv
    const type = searchParams.get('type') || 'accounts'; // accounts, stats, trends
    const status = searchParams.get('status'); // 筛选特定状态

    console.log(`📤 接收数据导出请求: format=${format}, type=${type}, status=${status}`);

    let data: any[] = [];
    let filename = '';
    let headers: string[] = [];

    switch (type) {
      case 'accounts':
        // 导出账号列表数据
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
            MAX(created_at) as last_upload
          FROM tiktok_videos_raw 
          WHERE author IS NOT NULL 
          ${status ? `AND author_status = $1` : ''}
          GROUP BY author, author_status
          ORDER BY total_plays DESC
        `;
        
        const accountsResult = await db.query(
          accountsQuery, 
          status ? [status] : []
        );
        
        data = accountsResult.rows.map(row => ({
          '账号名称': row.author,
          '账号状态': row.author_status || '未分类',
          '作品数量': parseInt(row.works_count),
          '总播放量': parseInt(row.total_plays),
          '总点赞数': parseInt(row.total_likes),
          '总评论数': parseInt(row.total_comments),
          '总分享数': parseInt(row.total_shares),
          '平均播放量': Math.round(parseFloat(row.avg_plays)),
          '平均点赞数': Math.round(parseFloat(row.avg_likes)),
          '首次发布': new Date(row.first_upload).toLocaleDateString('zh-CN'),
          '最后发布': new Date(row.last_upload).toLocaleDateString('zh-CN')
        }));
        
        filename = `账号统计数据_${new Date().toISOString().split('T')[0]}`;
        headers = ['账号名称', '账号状态', '作品数量', '总播放量', '总点赞数', '总评论数', '总分享数', '平均播放量', '平均点赞数', '首次发布', '最后发布'];
        break;

      case 'stats':
        // 导出统计概览数据
        const dashboardStats = await statsService.getDashboardStats();
        
        data = [
          { '指标': '总账号数', '数值': dashboardStats.totalAccounts },
          { '指标': '已分类账号数', '数值': dashboardStats.categorizedAccounts },
          { '指标': '未分类账号数', '数值': dashboardStats.uncategorizedAccounts },
          { '指标': '总作品数', '数值': dashboardStats.totalWorks },
          { '指标': '总播放量', '数值': dashboardStats.totalPlays },
          { '指标': '总点赞数', '数值': dashboardStats.totalLikes },
          { '指标': '平均每账号作品数', '数值': dashboardStats.avgWorksPerAccount },
          { '指标': '平均每作品播放量', '数值': dashboardStats.avgPlaysPerWork }
        ];
        
        // 添加状态分布数据
        dashboardStats.statusDistribution.forEach(item => {
          data.push({
            '指标': `${item.status}账号数`,
            '数值': item.count
          });
        });
        
        filename = `统计概览_${new Date().toISOString().split('T')[0]}`;
        headers = ['指标', '数值'];
        break;

      case 'trends':
        // 导出趋势数据
        const days = parseInt(searchParams.get('days') || '30');
        const trendsData = await statsService.getTrendData(days);
        
        data = trendsData.map(item => ({
          '日期': item.date,
          '发布作品数': item.worksCount,
          '总播放量': item.totalPlays,
          '总点赞数': item.totalLikes,
          '平均播放量': item.avgPlays,
          '活跃账号数': item.activeAccounts
        }));
        
        filename = `趋势数据_${days}天_${new Date().toISOString().split('T')[0]}`;
        headers = ['日期', '发布作品数', '总播放量', '总点赞数', '平均播放量', '活跃账号数'];
        break;

      default:
        return NextResponse.json({
          success: false,
          message: `不支持的导出类型: ${type}`,
          error: {
            code: 'INVALID_EXPORT_TYPE',
            message: '支持的类型: accounts, stats, trends',
            timestamp: new Date()
          }
        } as ApiResponse, { status: 400 });
    }

    if (data.length === 0) {
      return NextResponse.json({
        success: false,
        message: '没有可导出的数据',
        error: {
          code: 'NO_DATA_TO_EXPORT',
          message: '请检查筛选条件或确保数据库中有相应数据',
          timestamp: new Date()
        }
      } as ApiResponse, { status: 404 });
    }

    // 根据格式生成文件
    let responseBuffer: Buffer;
    let contentType: string;
    let fileExtension: string;

    if (format === 'csv') {
      // 生成CSV格式
      const csvRows = [headers.join(',')];
      data.forEach(row => {
        const values = headers.map(header => {
          const value = row[header];
          // 处理包含逗号或引号的值
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        csvRows.push(values.join(','));
      });
      
      const csvContent = '\uFEFF' + csvRows.join('\n'); // 添加BOM以支持中文
      responseBuffer = Buffer.from(csvContent, 'utf8');
      contentType = 'text/csv; charset=utf-8';
      fileExtension = 'csv';
    } else {
      // 生成Excel格式
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '数据');
      
      // 设置列宽
      const colWidths = headers.map(header => ({
        wch: Math.max(header.length, 15)
      }));
      worksheet['!cols'] = colWidths;
      
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      responseBuffer = Buffer.from(excelBuffer);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      fileExtension = 'xlsx';
    }

    console.log(`✅ 数据导出成功: ${data.length} 条记录, 格式: ${format}`);

    return new Response(responseBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.${fileExtension}"`,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('❌ 数据导出失败:', error);

    const errorResponse: ApiResponse = {
      success: false,
      message: '数据导出失败',
      error: {
        code: 'EXPORT_ERROR',
        message: error instanceof Error ? error.message : '未知错误',
        timestamp: new Date()
      }
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * OPTIONS /api/stats/export
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