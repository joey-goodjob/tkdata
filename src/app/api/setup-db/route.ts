import { NextRequest, NextResponse } from 'next/server';
import { databaseSetup } from '@/lib/databaseSetup';

/**
 * API路由：设置和测试数据库表字段扩展
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 开始数据库扩展设置...');
    
    const success = await databaseSetup.setupDatabase();
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: '数据库扩展设置成功完成',
        features: [
          '✓ 验证和创建 author_status 字段',
          '✓ 添加数据溯源追踪字段',
          '✓ 创建性能优化索引',
          '✓ 验证字段状态',
          '✓ 生成统计报告'
        ],
        nextSteps: [
          '1. 创建 merge_operations 审计表',
          '2. 创建 classification_audit 历史表',
          '3. 开发冲突检测服务'
        ]
      });
    } else {
      return NextResponse.json({
        success: false,
        message: '数据库扩展设置失败',
        error: '请检查服务器日志了解详细错误信息'
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('数据库扩展API错误:', error);
    return NextResponse.json({
      success: false,
      message: '数据库扩展过程中发生错误',
      error: error instanceof Error ? error.message : '未知错误',
      troubleshooting: [
        '检查数据库连接是否正常',
        '验证环境变量配置',
        '确认数据库权限足够',
        '查看服务器控制台日志'
      ]
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: '数据库扩展设置API',
    usage: 'POST /api/setup-db 来执行数据库字段扩展',
    description: '扩展 tiktok_videos_raw 表，添加数据溯源追踪字段和索引'
  });
}