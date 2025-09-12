// 类型验证工具 - 用于测试类型定义的正确性

import type {
  Account,
  AccountStatus,
  DashboardStats,
  StatusDistribution,
  AccountFilters,
  PaginationInfo,
  ApiResponse,
  TiktokRawData
} from '../types';

// 测试Account类型
export function validateAccountType(): Account {
  return {
    author: 'TestAuthor',
    status: AccountStatus.FINISHED,
    worksCount: 100,
    totalPlays: 1000000,
    totalLikes: 50000,
    totalComments: 2000,
    totalShares: 500,
    totalCollects: 1000,
    avgPlays: 10000,
    avgLikes: 500,
    avgComments: 20,
    fansCount: 100000,
    firstPublishTime: new Date('2024-01-01'),
    lastPublishTime: new Date('2024-12-01'),
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

// 测试DashboardStats类型
export function validateDashboardStatsType(): DashboardStats {
  return {
    totalAccounts: 100,
    finishedAccounts: 40,
    semiFinishedAccounts: 30,
    unsetAccounts: 30,
    totalWorks: 5000,
    totalPlays: 50000000,
    totalLikes: 2500000,
    avgWorksPerAccount: 50,
    avgPlaysPerWork: 10000,
    statusDistribution: [
      {
        status: AccountStatus.FINISHED,
        label: '成品号',
        count: 40,
        percentage: 40,
        avgPlays: 15000,
        avgLikes: 750,
        avgWorks: 60,
        color: '#22C55E'
      }
    ],
    topAccounts: [
      {
        author: 'TopAuthor',
        status: AccountStatus.FINISHED,
        worksCount: 200,
        totalPlays: 5000000,
        avgPlays: 25000,
        rank: 1
      }
    ]
  };
}

// 测试AccountFilters类型
export function validateAccountFiltersType(): AccountFilters {
  return {
    search: 'test',
    status: AccountStatus.FINISHED,
    minWorks: 10,
    maxWorks: 1000,
    minPlays: 1000,
    maxPlays: 1000000,
    dateRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-12-31')
    },
    sortBy: 'totalPlays',
    sortOrder: 'desc'
  };
}

// 测试ApiResponse类型
export function validateApiResponseType(): ApiResponse<Account[]> {
  return {
    success: true,
    data: [validateAccountType()],
    message: 'Success',
    timestamp: new Date().toISOString()
  };
}

// 测试TiktokRawData类型（确保包含新的author_status字段）
export function validateTiktokRawDataType(): TiktokRawData {
  return {
    work_id: 'test123',
    author: 'TestAuthor',
    author_status: '成品号',  // 新增字段
    work_title: 'Test Video',
    play_count: 10000,
    like_count: 500,
    comment_count: 20,
    collect_count: 10,
    share_count: 5,
    publish_time: new Date(),
    author_fans_count: 100000,
    work_url: 'https://example.com'
  };
}

// 类型检查通过函数
export function runTypeValidation(): boolean {
  try {
    // 验证所有主要类型
    const account = validateAccountType();
    const stats = validateDashboardStatsType();
    const filters = validateAccountFiltersType();
    const apiResponse = validateApiResponseType();
    const tiktokData = validateTiktokRawDataType();

    // 确保基本属性存在
    console.log('✅ 类型验证通过:');
    console.log(`   Account: ${account.author} (${account.status})`);
    console.log(`   Stats: ${stats.totalAccounts} 总账号`);
    console.log(`   TikTok数据包含author_status: ${!!tiktokData.author_status}`);
    
    return true;
  } catch (error) {
    console.error('❌ 类型验证失败:', error);
    return false;
  }
}

// 导出所有验证函数
export default {
  validateAccountType,
  validateDashboardStatsType,
  validateAccountFiltersType,
  validateApiResponseType,
  validateTiktokRawDataType,
  runTypeValidation
};