// 错误类型枚举
export enum ErrorType {
  // 文件相关错误
  FILE_FORMAT = 'FILE_FORMAT',
  FILE_SIZE = 'FILE_SIZE',
  FILE_CORRUPT = 'FILE_CORRUPT',
  FILE_EMPTY = 'FILE_EMPTY',
  
  // Excel解析错误
  PARSING_ERROR = 'PARSING_ERROR',
  INVALID_HEADERS = 'INVALID_HEADERS',
  NO_DATA_ROWS = 'NO_DATA_ROWS',
  
  // 数据验证错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',
  INVALID_DATA_TYPE = 'INVALID_DATA_TYPE',
  
  // 数据库错误
  DATABASE_ERROR = 'DATABASE_ERROR',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  INSERT_FAILED = 'INSERT_FAILED',
  
  // 网络和系统错误
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  SYSTEM_ERROR = 'SYSTEM_ERROR'
}

// 错误级别
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// 错误接口
export interface SystemError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  details?: any;
  timestamp: Date;
  row?: number;
  field?: string;
  batch?: number;
  stack?: string;
}

// 处理结果接口
export interface ProcessingResult {
  success: boolean;
  data?: any;
  errors: SystemError[];
  warnings: SystemError[];
  metadata?: {
    totalRows?: number;
    processedRows?: number;
    validRows?: number;
    processingTime?: number;
  };
}

// 用户友好的错误消息映射
const ERROR_MESSAGES: Record<ErrorType, { message: string; suggestion: string }> = {
  [ErrorType.FILE_FORMAT]: {
    message: '文件格式不正确',
    suggestion: '请上传.xlsx或.xls格式的Excel文件'
  },
  [ErrorType.FILE_SIZE]: {
    message: '文件大小超出限制',
    suggestion: '文件大小不能超过50MB，请压缩后重新上传'
  },
  [ErrorType.FILE_CORRUPT]: {
    message: 'Excel文件已损坏',
    suggestion: '请检查文件完整性或重新导出Excel文件'
  },
  [ErrorType.FILE_EMPTY]: {
    message: 'Excel文件为空',
    suggestion: '请确保Excel文件包含数据内容'
  },
  [ErrorType.PARSING_ERROR]: {
    message: 'Excel文件解析失败',
    suggestion: '请检查Excel文件格式是否正确，建议另存为标准Excel格式'
  },
  [ErrorType.INVALID_HEADERS]: {
    message: 'Excel表头不符合要求',
    suggestion: '请确保Excel文件包含必要的列名，如：作品id、作者、作品标题等'
  },
  [ErrorType.NO_DATA_ROWS]: {
    message: 'Excel文件没有数据行',
    suggestion: '请确保Excel文件除表头外还包含实际数据'
  },
  [ErrorType.VALIDATION_ERROR]: {
    message: '数据验证失败',
    suggestion: '请检查数据格式是否正确'
  },
  [ErrorType.REQUIRED_FIELD_MISSING]: {
    message: '缺少必填字段',
    suggestion: '请确保每行数据都包含作品ID和作者信息'
  },
  [ErrorType.INVALID_DATA_TYPE]: {
    message: '数据类型不正确',
    suggestion: '请检查数值字段是否为数字格式，日期字段是否为日期格式'
  },
  [ErrorType.DATABASE_ERROR]: {
    message: '数据库操作失败',
    suggestion: '请稍后重试，如问题持续存在请联系管理员'
  },
  [ErrorType.CONNECTION_FAILED]: {
    message: '数据库连接失败',
    suggestion: '请检查网络连接或稍后重试'
  },
  [ErrorType.TRANSACTION_FAILED]: {
    message: '数据库事务失败',
    suggestion: '数据操作已回滚，请重新尝试上传'
  },
  [ErrorType.INSERT_FAILED]: {
    message: '数据插入失败',
    suggestion: '请检查数据格式是否符合要求'
  },
  [ErrorType.NETWORK_ERROR]: {
    message: '网络连接错误',
    suggestion: '请检查网络连接状态'
  },
  [ErrorType.TIMEOUT_ERROR]: {
    message: '操作超时',
    suggestion: '文件处理时间过长，建议分批上传或减少数据量'
  },
  [ErrorType.MEMORY_ERROR]: {
    message: '内存不足',
    suggestion: '文件过大导致内存不足，请减少数据量或分批上传'
  },
  [ErrorType.SYSTEM_ERROR]: {
    message: '系统错误',
    suggestion: '系统内部错误，请稍后重试'
  }
};

/**
 * 系统错误处理器
 */
export class ErrorHandler {
  
  /**
   * 创建系统错误
   */
  static createError(
    type: ErrorType,
    originalError?: Error | string,
    context?: {
      row?: number;
      field?: string;
      batch?: number;
      details?: any;
    }
  ): SystemError {
    const errorConfig = ERROR_MESSAGES[type];
    const originalMessage = typeof originalError === 'string' ? originalError : originalError?.message || '';
    
    return {
      type,
      severity: this.getSeverity(type),
      message: originalMessage || errorConfig.message,
      userMessage: `${errorConfig.message}：${errorConfig.suggestion}`,
      details: context?.details,
      timestamp: new Date(),
      row: context?.row,
      field: context?.field,
      batch: context?.batch,
      stack: originalError instanceof Error ? originalError.stack : undefined
    };
  }

  /**
   * 获取错误严重程度
   */
  private static getSeverity(type: ErrorType): ErrorSeverity {
    const criticalErrors = [
      ErrorType.DATABASE_ERROR,
      ErrorType.CONNECTION_FAILED,
      ErrorType.SYSTEM_ERROR,
      ErrorType.MEMORY_ERROR
    ];

    const highErrors = [
      ErrorType.TRANSACTION_FAILED,
      ErrorType.INSERT_FAILED,
      ErrorType.FILE_CORRUPT
    ];

    const mediumErrors = [
      ErrorType.PARSING_ERROR,
      ErrorType.VALIDATION_ERROR,
      ErrorType.TIMEOUT_ERROR
    ];

    if (criticalErrors.includes(type)) return ErrorSeverity.CRITICAL;
    if (highErrors.includes(type)) return ErrorSeverity.HIGH;
    if (mediumErrors.includes(type)) return ErrorSeverity.MEDIUM;
    
    return ErrorSeverity.LOW;
  }

  /**
   * 处理文件验证错误
   */
  static handleFileError(error: Error | string, filename?: string): SystemError {
    const message = typeof error === 'string' ? error : error.message;
    
    if (message.includes('size') || message.includes('大小')) {
      return this.createError(ErrorType.FILE_SIZE, error, {
        details: { filename }
      });
    }
    
    if (message.includes('format') || message.includes('格式')) {
      return this.createError(ErrorType.FILE_FORMAT, error, {
        details: { filename }
      });
    }
    
    if (message.includes('corrupt') || message.includes('损坏')) {
      return this.createError(ErrorType.FILE_CORRUPT, error, {
        details: { filename }
      });
    }
    
    if (message.includes('empty') || message.includes('为空')) {
      return this.createError(ErrorType.FILE_EMPTY, error, {
        details: { filename }
      });
    }
    
    return this.createError(ErrorType.PARSING_ERROR, error, {
      details: { filename }
    });
  }

  /**
   * 处理数据验证错误
   */
  static handleValidationError(
    error: Error | string, 
    row?: number, 
    field?: string
  ): SystemError {
    const message = typeof error === 'string' ? error : error.message;
    
    if (message.includes('required') || message.includes('必填')) {
      return this.createError(ErrorType.REQUIRED_FIELD_MISSING, error, {
        row, field
      });
    }
    
    if (message.includes('type') || message.includes('类型')) {
      return this.createError(ErrorType.INVALID_DATA_TYPE, error, {
        row, field
      });
    }
    
    return this.createError(ErrorType.VALIDATION_ERROR, error, {
      row, field
    });
  }

  /**
   * 处理数据库错误
   */
  static handleDatabaseError(error: Error | string, batch?: number): SystemError {
    const message = typeof error === 'string' ? error : error.message;
    
    if (message.includes('connect') || message.includes('连接')) {
      return this.createError(ErrorType.CONNECTION_FAILED, error, { batch });
    }
    
    if (message.includes('transaction') || message.includes('事务')) {
      return this.createError(ErrorType.TRANSACTION_FAILED, error, { batch });
    }
    
    if (message.includes('insert') || message.includes('插入')) {
      return this.createError(ErrorType.INSERT_FAILED, error, { batch });
    }
    
    return this.createError(ErrorType.DATABASE_ERROR, error, { batch });
  }

  /**
   * 创建处理结果
   */
  static createResult(
    success: boolean,
    data?: any,
    errors: SystemError[] = [],
    warnings: SystemError[] = [],
    metadata?: any
  ): ProcessingResult {
    return {
      success,
      data,
      errors,
      warnings,
      metadata
    };
  }

  /**
   * 格式化错误信息用于API响应
   */
  static formatErrorResponse(errors: SystemError[]): {
    success: false;
    error: {
      type: string;
      message: string;
      details: any[];
    };
  } {
    // 选择最严重的错误作为主要错误
    const primaryError = this.getPrimaryError(errors);
    
    return {
      success: false,
      error: {
        type: primaryError.type,
        message: primaryError.userMessage,
        details: errors.map(err => ({
          type: err.type,
          message: err.userMessage,
          row: err.row,
          field: err.field,
          batch: err.batch,
          timestamp: err.timestamp
        }))
      }
    };
  }

  /**
   * 获取最严重的错误
   */
  private static getPrimaryError(errors: SystemError[]): SystemError {
    if (errors.length === 0) {
      return this.createError(ErrorType.SYSTEM_ERROR, 'Unknown error');
    }

    const severityOrder = [
      ErrorSeverity.CRITICAL,
      ErrorSeverity.HIGH,
      ErrorSeverity.MEDIUM,
      ErrorSeverity.LOW
    ];

    for (const severity of severityOrder) {
      const error = errors.find(err => err.severity === severity);
      if (error) return error;
    }

    return errors[0];
  }

  /**
   * 日志记录错误
   */
  static logError(error: SystemError): void {
    const logLevel = this.getLogLevel(error.severity);
    const logMessage = `[${error.type}] ${error.message}`;
    
    console[logLevel](logMessage, {
      severity: error.severity,
      timestamp: error.timestamp,
      row: error.row,
      field: error.field,
      batch: error.batch,
      details: error.details,
      stack: error.stack
    });
  }

  /**
   * 获取日志级别
   */
  private static getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.LOW:
      default:
        return 'info';
    }
  }

  /**
   * 检查是否应该停止处理
   */
  static shouldStopProcessing(errors: SystemError[]): boolean {
    // 遇到关键或高级错误立即停止
    return errors.some(error => 
      error.severity === ErrorSeverity.CRITICAL || 
      error.severity === ErrorSeverity.HIGH
    );
  }
}

// 导出常用的错误创建函数
export const createFileError = ErrorHandler.handleFileError;
export const createValidationError = ErrorHandler.handleValidationError;
export const createDatabaseError = ErrorHandler.handleDatabaseError;