// 测试数据库扩展功能的脚本
require('dotenv').config();

async function testDatabaseExtension() {
  console.log('🔧 测试数据库表字段扩展功能...\n');

  try {
    // 动态导入 DatabaseSetup 类
    const { databaseSetup } = await import('./src/lib/databaseSetup.ts');
    
    console.log('📝 开始执行数据库扩展设置...');
    const success = await databaseSetup.setupDatabase();
    
    if (success) {
      console.log('\n🎉 数据库扩展测试成功！');
      console.log('\n✅ 完成的功能:');
      console.log('   - ✓ 验证和创建 author_status 字段');
      console.log('   - ✓ 添加数据溯源追踪字段:');
      console.log('     • classification_source (分类来源)');
      console.log('     • classification_time (分类时间)');
      console.log('     • last_import_time (最后导入时间)');
      console.log('     • manual_classified (手动分类标识)');
      console.log('   - ✓ 创建性能优化索引');
      console.log('   - ✓ 验证字段状态');
      console.log('   - ✓ 生成统计报告');
      
      console.log('\n📋 下一步：');
      console.log('   1. 创建 merge_operations 审计表');
      console.log('   2. 创建 classification_audit 历史表');
      console.log('   3. 开发冲突检测服务');
      
    } else {
      console.log('\n❌ 数据库扩展测试失败');
      console.log('请检查错误信息并修复问题后重试');
    }
    
  } catch (error) {
    console.error('\n💥 测试执行过程中发生错误:', error);
    console.log('\n🔍 可能的原因:');
    console.log('   - 数据库连接问题');
    console.log('   - 环境变量配置错误');
    console.log('   - 权限不足');
    console.log('   - TypeScript 编译问题');
  }
}

// 运行测试
testDatabaseExtension().catch(console.error);