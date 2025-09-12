// 测试账号管理API的脚本
require('dotenv').config();

async function testAccountsAPI() {
  console.log('👥 测试账号管理API...\n');

  const baseUrl = 'http://localhost:3002';
  
  const testCases = [
    {
      name: '获取账号列表 (默认参数)',
      url: '/api/accounts',
      method: 'GET'
    },
    {
      name: '获取账号列表 (分页)',
      url: '/api/accounts?page=1&limit=5',
      method: 'GET'
    },
    {
      name: '搜索账号',
      url: '/api/accounts?search=test&limit=5',
      method: 'GET'
    },
    {
      name: '筛选成品号账号',
      url: '/api/accounts?status=成品号&limit=5',
      method: 'GET'
    },
    {
      name: '筛选未分类账号',
      url: '/api/accounts?status=unclassified&limit=5',
      method: 'GET'
    },
    {
      name: '按播放量排序',
      url: '/api/accounts?sortBy=totalPlays&sortOrder=desc&limit=5',
      method: 'GET'
    },
    {
      name: '按作品数排序',
      url: '/api/accounts?sortBy=worksCount&sortOrder=desc&limit=5',
      method: 'GET'
    }
  ];

  // 测试GET请求
  for (const testCase of testCases) {
    try {
      console.log(`🔍 测试: ${testCase.name}`);
      console.log(`   URL: ${testCase.url}`);
      
      const response = await fetch(`${baseUrl}${testCase.url}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        const accounts = data.data.data || [];
        const total = data.data.total || 0;
        const pagination = data.data.pagination || {};
        
        console.log(`   ✅ 成功 - ${data.message}`);
        console.log(`   📊 账号数: ${accounts.length}/${total}`);
        console.log(`   📄 分页: ${pagination.page}/${pagination.totalPages}`);
        
        if (accounts.length > 0) {
          const firstAccount = accounts[0];
          console.log(`   👤 示例账号: ${firstAccount.author} (${firstAccount.status || '未分类'})`);
          console.log(`       作品: ${firstAccount.worksCount}, 播放: ${firstAccount.totalPlays}, 点赞: ${firstAccount.totalLikes}`);
        }
      } else {
        console.log(`   ❌ 失败 (${response.status}) - ${data.message || data.error?.message || '未知错误'}`);
      }
      
    } catch (error) {
      console.log(`   ❌ 请求失败: ${error.message}`);
    }
    
    console.log(''); // 空行
  }

  // 测试单个账号操作
  console.log('🔍 测试单个账号操作:');
  try {
    // 首先获取一个账号名称
    const response = await fetch(`${baseUrl}/api/accounts?limit=1`);
    const data = await response.json();
    
    if (data.success && data.data.data.length > 0) {
      const testAccount = data.data.data[0].author;
      console.log(`   测试账号: ${testAccount}`);
      
      // 测试获取单个账号详情
      console.log('   📋 获取账号详情...');
      const detailResponse = await fetch(`${baseUrl}/api/accounts/${encodeURIComponent(testAccount)}`);
      const detailData = await detailResponse.json();
      
      if (detailResponse.ok && detailData.success) {
        console.log('   ✅ 账号详情获取成功');
        console.log(`   📊 详细统计: 作品${detailData.data.worksCount}个, 最高播放${detailData.data.maxPlays}`);
      } else {
        console.log('   ❌ 账号详情获取失败');
      }
      
      // 测试更新账号状态
      console.log('   📝 测试状态更新...');
      const updateResponse = await fetch(`${baseUrl}/api/accounts/${encodeURIComponent(testAccount)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: '半成品号' }),
      });
      
      const updateData = await updateResponse.json();
      
      if (updateResponse.ok && updateData.success) {
        console.log('   ✅ 状态更新成功');
        console.log(`   📝 更新结果: ${updateData.message}`);
        
        // 恢复原状态 (设为null)
        await fetch(`${baseUrl}/api/accounts/${encodeURIComponent(testAccount)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: null }),
        });
        console.log('   🔄 已恢复原状态');
      } else {
        console.log('   ❌ 状态更新失败');
      }
      
    } else {
      console.log('   ⚠️  无法获取测试账号');
    }
  } catch (error) {
    console.log(`   ❌ 单个账号操作失败: ${error.message}`);
  }
  
  console.log('');

  // 测试批量操作
  console.log('🔍 测试批量操作:');
  try {
    // 获取几个账号用于批量测试
    const response = await fetch(`${baseUrl}/api/accounts?limit=3`);
    const data = await response.json();
    
    if (data.success && data.data.data.length > 0) {
      const testAccounts = data.data.data.map(account => account.author).slice(0, 2);
      console.log(`   测试账号: ${testAccounts.join(', ')}`);
      
      // 批量设置为成品号
      const batchResponse = await fetch(`${baseUrl}/api/accounts/batch`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accounts: testAccounts,
          status: '成品号'
        }),
      });
      
      const batchData = await batchResponse.json();
      
      if (batchResponse.ok && batchData.success) {
        console.log('   ✅ 批量更新成功');
        console.log(`   📝 更新结果: ${batchData.message}`);
        console.log(`   📊 影响账号: ${batchData.data.accountsCount}, 记录: ${batchData.data.totalUpdatedRecords}`);
        
        // 批量恢复状态
        await fetch(`${baseUrl}/api/accounts/batch`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accounts: testAccounts,
            status: null
          }),
        });
        console.log('   🔄 已批量恢复原状态');
      } else {
        console.log('   ❌ 批量更新失败');
      }
      
    } else {
      console.log('   ⚠️  无法获取测试账号');
    }
  } catch (error) {
    console.log(`   ❌ 批量操作失败: ${error.message}`);
  }

  // 测试错误处理
  console.log('\n🔍 测试错误处理:');
  const errorTests = [
    {
      name: '无效排序字段',
      url: '/api/accounts?sortBy=invalid',
    },
    {
      name: '获取不存在的账号',
      url: '/api/accounts/nonexistent-account',
    },
    {
      name: '更新不存在的账号',
      url: '/api/accounts/nonexistent-account',
      method: 'PUT',
      body: { status: '成品号' }
    },
    {
      name: '无效的状态值',
      url: '/api/accounts/batch',
      method: 'PUT',
      body: { accounts: ['test'], status: 'invalid-status' }
    }
  ];

  for (const test of errorTests) {
    try {
      console.log(`   测试: ${test.name}`);
      
      const options = { method: test.method || 'GET' };
      if (test.body) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(test.body);
      }
      
      const response = await fetch(`${baseUrl}${test.url}`, options);
      const data = await response.json();
      
      if (!response.ok) {
        console.log('   ✅ 错误处理正常 - 返回错误状态');
      } else if (!data.success) {
        console.log('   ✅ 错误处理正常 - 返回错误响应');
      } else {
        console.log('   ❌ 错误处理异常 - 应该返回错误');
      }
    } catch (error) {
      console.log('   ⚠️  请求失败，可能服务器未启动');
    }
  }
  
  console.log('\n🎉 账号管理API测试完成！');
}

// 运行测试
testAccountsAPI().catch(console.error);