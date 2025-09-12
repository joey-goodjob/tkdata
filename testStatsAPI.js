// 测试统计API的脚本
require('dotenv').config();

async function testStatsAPI() {
  console.log('📊 测试统计服务API...\n');

  const baseUrl = 'http://localhost:3002';  // 开发服务器地址
  
  const endpoints = [
    { name: '仪表板统计', url: '/api/stats?type=dashboard' },
    { name: '趋势数据', url: '/api/stats?type=trends&days=7' },
    { name: '排行榜', url: '/api/stats?type=rankings&sortBy=totalPlays&limit=5' },
    { name: '性能分析', url: '/api/stats?type=performance' },
    { name: '状态统计', url: '/api/stats?type=status&status=all' }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 测试: ${endpoint.name}`);
      console.log(`   URL: ${endpoint.url}`);
      
      const response = await fetch(`${baseUrl}${endpoint.url}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log(`   ✅ 成功 - ${data.message}`);
        if (endpoint.name === '仪表板统计' && data.data) {
          console.log(`   📊 总账号数: ${data.data.totalAccounts}`);
          console.log(`   📈 状态分布: ${data.data.statusDistribution?.length || 0} 种状态`);
        }
      } else {
        console.log(`   ❌ 失败 - ${data.message || data.error?.message || '未知错误'}`);
      }
      
    } catch (error) {
      console.log(`   ❌ 请求失败: ${error.message}`);
    }
    
    console.log(''); // 空行
  }
  
  // 测试错误处理
  console.log('🔍 测试错误处理:');
  try {
    const response = await fetch(`${baseUrl}/api/stats?type=invalid`);
    const data = await response.json();
    
    if (!response.ok) {
      console.log('   ✅ 错误处理正常 - 返回400状态码');
    } else {
      console.log('   ❌ 错误处理异常 - 应该返回错误');
    }
  } catch (error) {
    console.log('   ⚠️  请求失败，可能服务器未启动');
  }
  
  console.log('\n🎉 统计API测试完成！');
}

// 运行测试
testStatsAPI().catch(console.error);