import { NextRequest, NextResponse } from 'next/server';
import { auditService, AuditQueryOptions } from '@/lib/auditService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const options: AuditQueryOptions = {
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
      userId: searchParams.get('userId') || undefined,
      strategy: searchParams.get('strategy') || undefined,
      status: searchParams.get('status') || undefined,
      author: searchParams.get('author') || undefined,
      source: searchParams.get('source') || undefined
    };

    // 处理日期参数
    if (searchParams.get('startDate')) {
      options.startDate = new Date(searchParams.get('startDate')!);
    }
    if (searchParams.get('endDate')) {
      options.endDate = new Date(searchParams.get('endDate')!);
    }

    // 获取操作类型 - 操作历史 or 分类变更历史
    const type = searchParams.get('type') || 'operations';

    let result;
    if (type === 'operations') {
      // 查询合并操作历史
      result = await auditService.getMergeOperations(options);
      return NextResponse.json({
        success: true,
        type: 'operations',
        data: result.operations,
        pagination: {
          total: result.total,
          limit: options.limit,
          offset: options.offset,
          hasMore: result.hasMore
        }
      });
    } else if (type === 'changes') {
      // 查询分类变更历史
      result = await auditService.getClassificationChanges(options);
      return NextResponse.json({
        success: true,
        type: 'changes',
        data: result.changes,
        pagination: {
          total: result.total,
          limit: options.limit,
          offset: options.offset,
          hasMore: result.hasMore
        }
      });
    } else if (type === 'statistics') {
      // 获取统计信息
      const statistics = await auditService.getAuditStatistics();
      return NextResponse.json({
        success: true,
        type: 'statistics',
        data: statistics
      });
    } else {
      return NextResponse.json({
        success: false,
        error: '不支持的查询类型，支持的类型: operations, changes, statistics'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('查询审计历史失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// 获取特定操作的详细信息
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, operationId, author } = body;

    if (action === 'operation_details') {
      if (!operationId) {
        return NextResponse.json({
          success: false,
          error: 'operationId 参数是必需的'
        }, { status: 400 });
      }

      const details = await auditService.getOperationDetails(operationId);
      return NextResponse.json({
        success: true,
        action: 'operation_details',
        data: {
          operation: details.operation,
          relatedChanges: details.relatedChanges
        }
      });

    } else if (action === 'account_history') {
      if (!author) {
        return NextResponse.json({
          success: false,
          error: 'author 参数是必需的'
        }, { status: 400 });
      }

      const limit = body.limit || 50;
      const history = await auditService.getAccountChangeHistory(author, limit);
      return NextResponse.json({
        success: true,
        action: 'account_history',
        data: history
      });

    } else if (action === 'export_report') {
      const startDate = body.startDate ? new Date(body.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = body.endDate ? new Date(body.endDate) : new Date();

      const report = await auditService.exportAuditReport(startDate, endDate);
      return NextResponse.json({
        success: true,
        action: 'export_report',
        data: report
      });

    } else {
      return NextResponse.json({
        success: false,
        error: '不支持的操作类型，支持的操作: operation_details, account_history, export_report'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('处理审计查询请求失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}