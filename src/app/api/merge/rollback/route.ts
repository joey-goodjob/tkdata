import { NextRequest, NextResponse } from 'next/server';
import { auditService } from '@/lib/auditService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operationId, userId, dryRun } = body;

    // 验证必需参数
    if (!operationId) {
      return NextResponse.json({
        success: false,
        error: 'operationId 参数是必需的'
      }, { status: 400 });
    }

    // 验证操作ID格式（UUID格式）
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(operationId)) {
      return NextResponse.json({
        success: false,
        error: 'operationId 格式无效，必须是有效的UUID'
      }, { status: 400 });
    }

    // 如果是演示模式，先获取操作详情进行验证
    if (dryRun) {
      const operationDetails = await auditService.getOperationDetails(operationId);
      
      if (!operationDetails.operation) {
        return NextResponse.json({
          success: false,
          error: `操作 ${operationId} 不存在`
        }, { status: 404 });
      }

      const operation = operationDetails.operation;

      // 检查操作是否可以回滚
      if (operation.status.includes('rolled_back')) {
        return NextResponse.json({
          success: false,
          error: '该操作已经被回滚过，无法再次回滚'
        }, { status: 400 });
      }

      if (!operation.rollback_data || Object.keys(operation.rollback_data).length === 0) {
        return NextResponse.json({
          success: false,
          error: '该操作没有回滚数据，无法执行回滚'
        }, { status: 400 });
      }

      // 返回预览信息
      return NextResponse.json({
        success: true,
        dryRun: true,
        preview: {
          operationId,
          operationType: operation.strategy,
          operationTime: operation.timestamp,
          affectedAccountCount: operation.affected_account_count,
          rollbackDataAvailable: !!operation.rollback_data,
          estimatedRollbackAccounts: operation.rollback_data?.affectedAccounts?.length || 0,
          canRollback: true
        },
        message: '回滚预览成功，操作可以安全回滚'
      });
    }

    console.log(`🔄 开始回滚操作: ${operationId}`);
    console.log(`   用户: ${userId || 'system'}`);

    // 执行回滚操作
    const rollbackResult = await auditService.rollbackOperation(
      operationId, 
      userId || 'system'
    );

    // 记录回滚结果
    console.log(`${rollbackResult.success ? '✅' : '❌'} 回滚操作完成:`);
    console.log(`   操作ID: ${rollbackResult.operationId}`);
    console.log(`   影响账号数: ${rollbackResult.affectedAccounts}`);
    console.log(`   恢复状态数: ${rollbackResult.restoredStates}`);
    console.log(`   错误数量: ${rollbackResult.errors.length}`);

    if (rollbackResult.errors.length > 0) {
      console.log('   错误详情:', rollbackResult.errors.slice(0, 3));
    }

    return NextResponse.json({
      success: rollbackResult.success,
      data: {
        operationId: rollbackResult.operationId,
        rollbackOperationId: rollbackResult.rollbackOperationId,
        affectedAccounts: rollbackResult.affectedAccounts,
        restoredStates: rollbackResult.restoredStates,
        errors: rollbackResult.errors
      },
      message: rollbackResult.success 
        ? `回滚操作成功完成，恢复了 ${rollbackResult.restoredStates} 个账号状态` 
        : `回滚操作完成但有 ${rollbackResult.errors.length} 个错误`,
      warnings: rollbackResult.errors.length > 0 ? rollbackResult.errors : undefined
    });

  } catch (error) {
    console.error('执行回滚操作失败:', error);
    
    // 根据错误类型返回不同的状态码
    let statusCode = 500;
    let errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('不存在')) {
      statusCode = 404;
    } else if (errorMessage.includes('已损坏') || errorMessage.includes('已过期') || errorMessage.includes('已回滚')) {
      statusCode = 400;
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: statusCode });
  }
}

// 获取可回滚的操作列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 查询可回滚的操作（有回滚数据且未被回滚的操作）
    const operations = await auditService.getMergeOperations({
      limit,
      offset,
      // 只获取未回滚的操作
    });

    // 过滤出可回滚的操作
    const rollbackableOperations = operations.operations.filter(op => {
      return !op.status.includes('rolled_back') && 
             op.rollback_data && 
             Object.keys(op.rollback_data).length > 0;
    });

    return NextResponse.json({
      success: true,
      data: rollbackableOperations.map(op => ({
        id: op.id,
        timestamp: op.timestamp,
        strategy: op.strategy,
        user_id: op.user_id,
        affected_account_count: op.affected_account_count,
        operation_summary: op.operation_summary,
        status: op.status,
        execution_time_ms: op.execution_time_ms,
        hasRollbackData: !!op.rollback_data && Object.keys(op.rollback_data).length > 0,
        canRollback: !op.status.includes('rolled_back')
      })),
      pagination: {
        total: rollbackableOperations.length,
        limit,
        offset,
        hasMore: offset + rollbackableOperations.length < operations.total
      }
    });

  } catch (error) {
    console.error('获取可回滚操作列表失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}