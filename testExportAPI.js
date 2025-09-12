// 测试导出API的脚本
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function testExportAPI() {
  console.log('📤 测试数据导出API...\n');

  const baseUrl = 'http://localhost:3002';
  const outputDir = './exports';
  
  // 创建导出目录
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
    console.log('📁 创建导出目录: ./exports\n');
  }
  
  const testCases = [
    { 
      name: '账号数据Excel导出', 
      url: '/api/stats/export?type=accounts&format=excel',
      filename: 'accounts.xlsx'
    },
    { 
      name: '账号数据CSV导出', 
      url: '/api/stats/export?type=accounts&format=csv',
      filename: 'accounts.csv'
    },
    { 
      name: '统计概览Excel导出', 
      url: '/api/stats/export?type=stats&format=excel',
      filename: 'stats.xlsx'
    },
    { 
      name: '趋势数据Excel导出', 
      url: '/api/stats/export?type=trends&days=7&format=excel',
      filename: 'trends.xlsx'
    },
    { 
      name: '筛选状态导出', 
      url: '/api/stats/export?type=accounts&status=成品号&format=excel',
      filename: 'finished_accounts.xlsx'
    }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`🔍 测试: ${testCase.name}`);
      console.log(`   URL: ${testCase.url}`);
      
      const response = await fetch(`${baseUrl}${testCase.url}`);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        const contentDisposition = response.headers.get('content-disposition');
        
        if (contentType && (contentType.includes('application/vnd.openxmlformats') || contentType.includes('text/csv'))) {
          // 这是文件下载响应
          const buffer = await response.arrayBuffer();
          const filePath = path.join(outputDir, testCase.filename);
          fs.writeFileSync(filePath, Buffer.from(buffer));
          
          const fileSize = (buffer.byteLength / 1024).toFixed(2);
          console.log(`   ✅ 成功 - 文件已保存: ${filePath} (${fileSize} KB)`);
          console.log(`   📋 Content-Type: ${contentType}`);
          if (contentDisposition) {
            console.log(`   📥 Content-Disposition: ${contentDisposition}`);
          }
        } else {
          // 这可能是错误响应
          const data = await response.json();
          if (data.success === false) {
            console.log(`   ⚠️  注意 - ${data.message}`);
          } else {
            console.log(`   ❌ 意外响应格式`);
          }
        }
      } else {
        const data = await response.json();
        console.log(`   ❌ 失败 (${response.status}) - ${data.message || data.error?.message || '未知错误'}`);
      }
      
    } catch (error) {
      console.log(`   ❌ 请求失败: ${error.message}`);
    }
    
    console.log(''); // 空行
  }
  
  // 测试错误处理
  console.log('🔍 测试错误处理:');
  try {
    const response = await fetch(`${baseUrl}/api/stats/export?type=invalid`);
    
    if (!response.ok) {
      const data = await response.json();
      console.log('   ✅ 错误处理正常 - 返回400状态码');
      console.log(`   📝 错误信息: ${data.message}`);
    } else {
      console.log('   ❌ 错误处理异常 - 应该返回错误');
    }
  } catch (error) {
    console.log('   ⚠️  请求失败，可能服务器未启动');
  }
  
  console.log('\n🎉 数据导出API测试完成！');
  console.log('📁 导出文件保存在: ./exports/ 目录');
}

// 运行测试
testExportAPI().catch(console.error);