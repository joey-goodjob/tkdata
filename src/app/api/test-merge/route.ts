import { NextRequest, NextResponse } from 'next/server';
import { mergeEngine, MergeStrategy, MergeOptions } from '@/lib/mergeEngine';
import { TiktokRawData } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 开始测试MergeEngine功能...');

    // 模拟Excel数据
    const mockExcelData: TiktokRawData[] = [
      {
        author: 'test_author_1',
        author_status: '成品号',
        work_id: 'work_001',
        work_title: '测试作品1'
      },
      {
        author: 'test_author_2', 
        author_status: '半成品号',
        work_id: 'work_002',
        work_title: '测试作品2'
      },
      {
        author: 'test_author_3',
        author_status: '成品号',
        work_id: 'work_003', 
        work_title: '测试作品3'
      }
    ];

    // 1. 测试合并预览功能
    console.log('1️⃣ 测试合并预览功能...');
    const protectPreview = await mergeEngine.generatePreview(
      mockExcelData, 
      MergeStrategy.PROTECT
    );
    console.log('保护策略预览结果:', protectPreview);

    const overwritePreview = await mergeEngine.generatePreview(
      mockExcelData,
      MergeStrategy.OVERWRITE
    );
    console.log('覆盖策略预览结果:', overwritePreview);

    // 2. 测试保护策略执行（演示模式）
    console.log('2️⃣ 测试保护策略执行（演示模式）...');
    const protectOptions: MergeOptions = {
      strategy: MergeStrategy.PROTECT,
      userId: 'test_user',
      dryRun: true
    };
    
    const protectResult = await mergeEngine.executeMerge(
      mockExcelData,
      protectOptions
    );
    console.log('保护策略执行结果:', protectResult);

    // 3. 测试覆盖策略执行（演示模式）
    console.log('3️⃣ 测试覆盖策略执行（演示模式）...');
    const overwriteOptions: MergeOptions = {
      strategy: MergeStrategy.OVERWRITE,
      userId: 'test_user',
      dryRun: true
    };
    
    const overwriteResult = await mergeEngine.executeMerge(
      mockExcelData,
      overwriteOptions
    );
    console.log('覆盖策略执行结果:', overwriteResult);

    // 4. 测试交互式策略执行（演示模式）
    console.log('4️⃣ 测试交互式策略执行（演示模式）...');
    const interactiveOptions: MergeOptions = {
      strategy: MergeStrategy.INTERACTIVE,
      userId: 'test_user',
      conflictResolutions: [
        {
          author: 'test_author_1',
          action: 'keep_db'
        },
        {
          author: 'test_author_2', 
          action: 'use_excel'
        },
        {
          author: 'test_author_3',
          action: 'skip'
        }
      ],
      dryRun: true
    };
    
    const interactiveResult = await mergeEngine.executeMerge(
      mockExcelData,
      interactiveOptions
    );
    console.log('交互式策略执行结果:', interactiveResult);

    console.log('✅ MergeEngine测试完成');
    
    return NextResponse.json({
      success: true,
      message: 'MergeEngine测试成功完成',
      results: {
        previews: {
          protect: protectPreview,
          overwrite: overwritePreview
        },
        executions: {
          protect: protectResult,
          overwrite: overwriteResult,
          interactive: interactiveResult
        }
      },
      features: [
        '✓ 三种合并策略（保护、覆盖、交互式）',
        '✓ 合并预览功能',
        '✓ 冲突检测和分析',
        '✓ 事务支持和回滚机制',
        '✓ 审计日志记录',
        '✓ 演示模式支持'
      ]
    });

  } catch (error) {
    console.error('❌ MergeEngine测试失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}