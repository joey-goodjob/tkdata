import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ author: string }> }
) {
  try {
    const { author } = await params;
    
    if (!author) {
      return NextResponse.json(
        { success: false, message: '账号名称不能为空' },
        { status: 400 }
      );
    }

    const decodedAuthor = decodeURIComponent(author);

    // 首先检查账号是否存在且未删除
    const checkResult = await db.query(`
      SELECT author, COUNT(*) as works_count
      FROM tiktok_videos_raw 
      WHERE author = $1 AND deleted_at IS NULL
      GROUP BY author
    `, [decodedAuthor]);

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: '账号不存在或已被删除' },
        { status: 404 }
      );
    }

    const worksCount = checkResult.rows[0].works_count;

    // 软删除：更新deleted_at字段
    const updateResult = await db.query(`
      UPDATE tiktok_videos_raw 
      SET deleted_at = CURRENT_TIMESTAMP,
          classification_time = CURRENT_TIMESTAMP,
          classification_source = 'manual'
      WHERE author = $1 AND deleted_at IS NULL
      RETURNING author
    `, [decodedAuthor]);

    if (updateResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: '删除失败：账号可能已被删除' },
        { status: 400 }
      );
    }

    // 记录删除操作到审计表（如果存在）
    try {
      await db.query(`
        INSERT INTO classification_audit (
          author, old_status, new_status, classification_source, additional_data
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        decodedAuthor,
        checkResult.rows[0].author_status || null,
        'deleted',
        'manual',
        JSON.stringify({
          action: 'account_deletion',
          works_count: worksCount,
          timestamp: new Date().toISOString()
        })
      ]);
    } catch (auditError) {
      // 审计记录失败不影响主要操作
      console.warn('审计记录失败:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: `成功删除账号 ${decodedAuthor}，共 ${worksCount} 条作品数据`,
      data: {
        author: decodedAuthor,
        deletedWorksCount: worksCount,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('删除账号失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : '删除账号时发生未知错误' 
      },
      { status: 500 }
    );
  }
}