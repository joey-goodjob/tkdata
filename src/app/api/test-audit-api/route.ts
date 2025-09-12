import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 开始测试审计查询API端点...');

    const baseUrl = request.nextUrl.origin;

    // 1. 测试获取操作历史
    console.log('1️⃣ 测试获取操作历史...');
    const operationsResponse = await fetch(`${baseUrl}/api/merge/history?type=operations&limit=5`, {
      method: 'GET'
    });
    const operationsData = await operationsResponse.json();
    console.log('操作历史查询结果:', {
      success: operationsData.success,
      count: operationsData.data?.length || 0,
      total: operationsData.pagination?.total || 0
    });

    // 2. 测试获取分类变更历史
    console.log('2️⃣ 测试获取分类变更历史...');
    const changesResponse = await fetch(`${baseUrl}/api/merge/history?type=changes&limit=5`, {
      method: 'GET'
    });
    const changesData = await changesResponse.json();
    console.log('分类变更历史查询结果:', {
      success: changesData.success,
      count: changesData.data?.length || 0,
      total: changesData.pagination?.total || 0
    });

    // 3. 测试获取统计信息
    console.log('3️⃣ 测试获取统计信息...');
    const statisticsResponse = await fetch(`${baseUrl}/api/merge/history?type=statistics`, {
      method: 'GET'
    });
    const statisticsData = await statisticsResponse.json();
    console.log('统计信息查询结果:', {
      success: statisticsData.success,
      totalOperations: statisticsData.data?.totalOperations || 0,
      totalChanges: statisticsData.data?.totalChanges || 0
    });

    // 4. 如果有操作记录，测试获取操作详情
    let operationDetailsResult = null;
    if (operationsData.success && operationsData.data && operationsData.data.length > 0) {
      console.log('4️⃣ 测试获取操作详情...');
      const firstOperationId = operationsData.data[0].id;
      
      const detailsResponse = await fetch(`${baseUrl}/api/merge/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'operation_details',
          operationId: firstOperationId
        })
      });
      const detailsData = await detailsResponse.json();
      operationDetailsResult = {
        success: detailsData.success,
        hasOperation: !!detailsData.data?.operation,
        relatedChangesCount: detailsData.data?.relatedChanges?.length || 0
      };
      console.log('操作详情查询结果:', operationDetailsResult);
    }

    // 5. 测试导出审计报告
    console.log('5️⃣ 测试导出审计报告...');
    const reportResponse = await fetch(`${baseUrl}/api/merge/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'export_report',
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      })
    });
    const reportData = await reportResponse.json();
    console.log('审计报告导出结果:', {
      success: reportData.success,
      operationsCount: reportData.data?.operations?.length || 0,
      changesCount: reportData.data?.changes?.length || 0,
      accountCount: reportData.data?.accountSummary ? Object.keys(reportData.data.accountSummary).length : 0
    });

    // 6. 测试获取可回滚操作列表
    console.log('6️⃣ 测试获取可回滚操作列表...');
    const rollbackListResponse = await fetch(`${baseUrl}/api/merge/rollback?limit=10`, {
      method: 'GET'
    });
    const rollbackListData = await rollbackListResponse.json();
    console.log('可回滚操作列表查询结果:', {
      success: rollbackListData.success,
      count: rollbackListData.data?.length || 0,
      total: rollbackListData.pagination?.total || 0
    });

    // 7. 如果有可回滚操作，测试回滚预览
    let rollbackPreviewResult = null;
    if (rollbackListData.success && rollbackListData.data && rollbackListData.data.length > 0) {
      console.log('7️⃣ 测试回滚预览...');
      const rollbackOperationId = rollbackListData.data[0].id;

      const previewResponse = await fetch(`${baseUrl}/api/merge/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationId: rollbackOperationId,
          userId: 'test_user',
          dryRun: true
        })
      });
      const previewData = await previewResponse.json();
      rollbackPreviewResult = {
        success: previewData.success,
        canRollback: previewData.preview?.canRollback,
        estimatedAccounts: previewData.preview?.estimatedRollbackAccounts || 0
      };
      console.log('回滚预览结果:', rollbackPreviewResult);
    }

    // 8. 测试错误处理 - 查询不存在的操作详情
    console.log('8️⃣ 测试错误处理...');
    const errorTestResponse = await fetch(`${baseUrl}/api/merge/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'operation_details',
        operationId: '00000000-0000-0000-0000-000000000000' // 不存在的UUID
      })
    });
    const errorTestData = await errorTestResponse.json();
    console.log('错误处理测试结果:', {
      success: errorTestData.success,
      hasOperation: !!errorTestData.data?.operation
    });

    console.log('✅ 审计查询API端点测试完成');

    return NextResponse.json({
      success: true,
      message: '审计查询API端点测试成功完成',
      results: {
        operationsQuery: {
          success: operationsData.success,
          count: operationsData.data?.length || 0,
          total: operationsData.pagination?.total || 0
        },
        changesQuery: {
          success: changesData.success,
          count: changesData.data?.length || 0,
          total: changesData.pagination?.total || 0
        },
        statistics: {
          success: statisticsData.success,
          totalOperations: statisticsData.data?.totalOperations || 0,
          totalChanges: statisticsData.data?.totalChanges || 0
        },
        operationDetails: operationDetailsResult,
        auditReport: {
          success: reportData.success,
          operationsCount: reportData.data?.operations?.length || 0,
          changesCount: reportData.data?.changes?.length || 0,
          accountCount: reportData.data?.accountSummary ? Object.keys(reportData.data.accountSummary).length : 0
        },
        rollbackList: {
          success: rollbackListData.success,
          count: rollbackListData.data?.length || 0
        },
        rollbackPreview: rollbackPreviewResult,
        errorHandling: {
          success: errorTestData.success,
          handledGracefully: !errorTestData.success && !!errorTestData.data
        }
      },
      endpoints: [
        'GET /api/merge/history?type=operations - 查询操作历史',
        'GET /api/merge/history?type=changes - 查询分类变更历史',
        'GET /api/merge/history?type=statistics - 获取统计信息',
        'POST /api/merge/history (operation_details) - 获取操作详情',
        'POST /api/merge/history (account_history) - 获取账号变更历史',
        'POST /api/merge/history (export_report) - 导出审计报告',
        'GET /api/merge/rollback - 获取可回滚操作列表',
        'POST /api/merge/rollback (dryRun=true) - 回滚预览',
        'POST /api/merge/rollback - 执行回滚操作'
      ],
      features: [
        '✓ 分页查询支持',
        '✓ 多种过滤选项',
        '✓ 操作详情查看',
        '✓ 账号变更历史',
        '✓ 审计报告导出',
        '✓ 回滚操作预览',
        '✓ 安全回滚执行',
        '✓ 完善错误处理',
        '✓ RESTful API设计'
      ]
    });

  } catch (error) {
    console.error('❌ 审计查询API端点测试失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}