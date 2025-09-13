import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET() {
  try {
    console.log('🩺 开始数据库健康检查...');
    
    // 执行健康检查
    const healthStatus = await db.healthCheck();
    
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      database: healthStatus.database,
      latency: `${healthStatus.latency}ms`,
      connectionPool: healthStatus.pool,
      queryQueue: healthStatus.queue,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercel: process.env.VERCEL === '1',
        databaseUrl: process.env.DATABASE_URL ? '已配置' : '未配置'
      }
    };

    console.log('✅ 数据库健康检查完成:', response);

    return NextResponse.json(response, {
      status: healthStatus.database ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('❌ 数据库健康检查失败:', error);

    const errorResponse = {
      success: false,
      timestamp: new Date().toISOString(),
      database: false,
      error: error instanceof Error ? error.message : '健康检查失败',
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercel: process.env.VERCEL === '1'
      }
    };

    return NextResponse.json(errorResponse, { status: 503 });
  }
}