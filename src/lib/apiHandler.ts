import { NextRequest, NextResponse } from 'next/server';
import { SystemError, ErrorHandler, ProcessingResult } from './errorHandler';

// API响应接口
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    type: string;
    message: string;
    details?: any[];
  };
  metadata?: {
    totalRows?: number;
    processedRows?: number;
    validRows?: number;
    processingTime?: number;
    timestamp?: string;
  };
}

// 上传结果接口
export interface UploadResult {
  totalRows: number;
  insertedRows: number;
  processingTime: number;
  errors?: string[];
  warnings?: string[];
}

/**
 * API处理器 - 统一处理API响应和错误
 */
export class ApiHandler {

  /**
   * 创建成功响应
   */
  static success<T>(
    data: T,
    metadata?: any,
    status: number = 200
  ): NextResponse<ApiResponse<T>> {
    return NextResponse.json({
      success: true,
      data,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    }, { status });
  }

  /**
   * 创建错误响应
   */
  static error(
    errors: SystemError | SystemError[],
    status?: number
  ): NextResponse<ApiResponse> {
    const errorArray = Array.isArray(errors) ? errors : [errors];
    
    // 记录所有错误
    errorArray.forEach(error => ErrorHandler.logError(error));
    
    const errorResponse = ErrorHandler.formatErrorResponse(errorArray);
    const responseStatus = status || this.getHttpStatus(errorArray[0]);
    
    return NextResponse.json(errorResponse, { status: responseStatus });
  }

  /**
   * 根据错误类型获取HTTP状态码
   */
  private static getHttpStatus(error: SystemError): number {
    const { type } = error;
    
    // 客户端错误 4xx
    const clientErrors = [
      'FILE_FORMAT', 'FILE_SIZE', 'FILE_CORRUPT', 'FILE_EMPTY',
      'INVALID_HEADERS', 'NO_DATA_ROWS', 'VALIDATION_ERROR',
      'REQUIRED_FIELD_MISSING', 'INVALID_DATA_TYPE'
    ];
    
    // 服务器错误 5xx
    const serverErrors = [
      'DATABASE_ERROR', 'CONNECTION_FAILED', 'TRANSACTION_FAILED',
      'INSERT_FAILED', 'SYSTEM_ERROR', 'MEMORY_ERROR'
    ];
    
    // 请求超时 408
    if (type === 'TIMEOUT_ERROR') return 408;
    
    // 网络错误 503
    if (type === 'NETWORK_ERROR') return 503;
    
    if (clientErrors.includes(type)) return 400;
    if (serverErrors.includes(type)) return 500;
    
    return 500; // 默认服务器错误
  }

  /**
   * 安全的异步处理包装器
   */
  static async safeHandler<T>(
    request: NextRequest,
    handler: (request: NextRequest) => Promise<NextResponse<ApiResponse<T>>>
  ): Promise<NextResponse<ApiResponse<T>>> {
    try {
      return await handler(request);
    } catch (error) {
      console.error('API Handler Error:', error);
      
      const systemError = ErrorHandler.createError(
        'SYSTEM_ERROR' as any,
        error instanceof Error ? error : String(error)
      );
      
      return this.error(systemError) as NextResponse<ApiResponse<T>>;
    }
  }

  /**
   * 验证请求方法
   */
  static validateMethod(
    request: NextRequest, 
    allowedMethods: string[]
  ): SystemError | null {
    if (!allowedMethods.includes(request.method)) {
      return ErrorHandler.createError(
        'SYSTEM_ERROR' as any,
        `方法 ${request.method} 不被允许`
      );
    }
    return null;
  }

  /**
   * 从FormData获取文件
   */
  static async getFileFromRequest(request: NextRequest): Promise<{
    file?: File;
    error?: SystemError;
  }> {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return {
          error: ErrorHandler.createError(
            'FILE_FORMAT' as any,
            '没有找到上传的文件'
          )
        };
      }
      
      return { file };
      
    } catch (error) {
      return {
        error: ErrorHandler.createError(
          'PARSING_ERROR' as any,
          `请求解析失败: ${error instanceof Error ? error.message : String(error)}`
        )
      };
    }
  }

  /**
   * 处理文件上传的通用流程
   */
  static async handleFileUpload(
    request: NextRequest,
    processor: (file: File) => Promise<ProcessingResult>
  ): Promise<NextResponse<ApiResponse<UploadResult>>> {
    // 验证请求方法
    const methodError = this.validateMethod(request, ['POST']);
    if (methodError) {
      return this.error(methodError);
    }

    // 获取上传的文件
    const { file, error: fileError } = await this.getFileFromRequest(request);
    if (fileError) {
      return this.error(fileError);
    }

    if (!file) {
      const error = ErrorHandler.createError(
        'FILE_EMPTY' as any,
        '文件不存在'
      );
      return this.error(error);
    }

    try {
      // 处理文件
      const result = await processor(file);
      
      if (!result.success) {
        return this.error(result.errors);
      }

      // 构建成功响应
      const uploadResult: UploadResult = {
        totalRows: result.metadata?.totalRows || 0,
        insertedRows: result.metadata?.processedRows || 0,
        processingTime: result.metadata?.processingTime || 0,
        errors: result.errors.map(e => e.userMessage),
        warnings: result.warnings.map(w => w.userMessage)
      };

      return this.success(uploadResult, {
        totalRows: uploadResult.totalRows,
        processedRows: uploadResult.insertedRows,
        processingTime: uploadResult.processingTime
      });

    } catch (error) {
      const systemError = ErrorHandler.createError(
        'SYSTEM_ERROR' as any,
        error instanceof Error ? error : String(error)
      );
      return this.error(systemError);
    }
  }

  /**
   * 创建处理进度的流式响应
   */
  static createProgressStream(): {
    stream: ReadableStream;
    updateProgress: (progress: {
      current: number;
      total: number;
      percentage: number;
      message?: string;
    }) => void;
    complete: (result: any) => void;
    error: (error: SystemError) => void;
  } {
    let controller: ReadableStreamDefaultController<Uint8Array>;
    
    const stream = new ReadableStream({
      start(streamController) {
        controller = streamController;
      }
    });

    const sendData = (data: any) => {
      const chunk = new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
      controller.enqueue(chunk);
    };

    return {
      stream,
      updateProgress: (progress) => {
        sendData({
          type: 'progress',
          ...progress,
          timestamp: new Date().toISOString()
        });
      },
      complete: (result) => {
        sendData({
          type: 'complete',
          result,
          timestamp: new Date().toISOString()
        });
        controller.close();
      },
      error: (error) => {
        sendData({
          type: 'error',
          error: {
            type: error.type,
            message: error.userMessage
          },
          timestamp: new Date().toISOString()
        });
        controller.close();
      }
    };
  }

  /**
   * 创建Server-Sent Events响应头
   */
  static createSSEHeaders(): Headers {
    return new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });
  }
}