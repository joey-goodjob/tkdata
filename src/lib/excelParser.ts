import * as XLSX from 'xlsx';

// Excel解析结果类型
export interface ExcelParseResult {
  success: boolean;
  data?: any[];
  headers?: string[];
  totalRows?: number;
  error?: string;
}

// 文件验证结果类型
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  size?: number;
  type?: string;
}

/**
 * Excel文件解析器类
 */
export class ExcelParser {
  
  // 支持的文件格式
  private static readonly SUPPORTED_FORMATS = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'application/excel',
    'application/x-excel',
    'application/x-msexcel'
  ];

  // 最大文件大小：50MB
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024;

  /**
   * 验证文件格式和大小
   */
  static validateFile(file: File): FileValidationResult {
    // 检查文件大小
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `文件大小超出限制。最大允许50MB，当前文件大小：${(file.size / 1024 / 1024).toFixed(2)}MB`,
        size: file.size,
        type: file.type
      };
    }

    // 检查文件类型
    const isValidFormat = this.SUPPORTED_FORMATS.includes(file.type) || 
                         file.name.toLowerCase().endsWith('.xlsx') ||
                         file.name.toLowerCase().endsWith('.xls');

    if (!isValidFormat) {
      return {
        valid: false,
        error: '不支持的文件格式。请上传.xlsx或.xls格式的Excel文件',
        size: file.size,
        type: file.type
      };
    }

    return {
      valid: true,
      size: file.size,
      type: file.type
    };
  }

  /**
   * 解析Excel文件Buffer
   */
  static parseBuffer(buffer: ArrayBuffer, filename?: string): ExcelParseResult {
    try {
      // 读取工作簿
      const workbook = XLSX.read(buffer, { 
        type: 'array',
        cellDates: true, // 自动处理日期
        cellNF: false,   // 不保留格式信息
        cellText: false  // 不转换为文本
      });

      // 获取第一个工作表
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return {
          success: false,
          error: 'Excel文件中没有找到工作表'
        };
      }

      const worksheet = workbook.Sheets[sheetName];
      
      // 转换为JSON数据
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1, // 使用数组格式，第一行作为表头
        raw: false, // 不保持原始值
        dateNF: 'yyyy-mm-dd hh:mm:ss' // 日期格式
      });

      if (jsonData.length === 0) {
        return {
          success: false,
          error: 'Excel文件为空或没有数据'
        };
      }

      // 提取表头
      const headers = jsonData[0] as string[];
      if (!headers || headers.length === 0) {
        return {
          success: false,
          error: 'Excel文件缺少表头'
        };
      }

      // 提取数据行
      const dataRows = jsonData.slice(1);
      
      // 将数组格式转换为对象格式
      const processedData = dataRows
        .filter((row): row is any[] => Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && cell !== ''))
        .map((row: any[]) => {
          const rowObject: any = {};
          headers.forEach((header, index) => {
            if (header && row[index] !== undefined) {
              rowObject[header.trim()] = row[index];
            }
          });
          return rowObject;
        });

      console.log(`Excel parsing completed: ${processedData.length} rows found`);
      console.log('Headers:', headers);

      return {
        success: true,
        data: processedData,
        headers: headers.map(h => String(h).trim()),
        totalRows: processedData.length
      };

    } catch (error) {
      console.error('Excel parsing error:', error);
      return {
        success: false,
        error: `Excel文件解析失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 解析Excel文件对象
   */
  static async parseFile(file: File): Promise<ExcelParseResult> {
    // 首先验证文件
    const validation = this.validateFile(file);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    try {
      // 读取文件内容
      const arrayBuffer = await file.arrayBuffer();
      
      // 解析Excel内容
      return this.parseBuffer(arrayBuffer, file.name);
      
    } catch (error) {
      console.error('File reading error:', error);
      return {
        success: false,
        error: `文件读取失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 获取Excel文件信息（不解析内容）
   */
  static async getFileInfo(file: File): Promise<{
    name: string;
    size: number;
    sizeFormatted: string;
    type: string;
    lastModified: Date;
  }> {
    return {
      name: file.name,
      size: file.size,
      sizeFormatted: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      type: file.type,
      lastModified: new Date(file.lastModified)
    };
  }

  /**
   * 预览Excel文件内容（只返回前几行）
   */
  static async previewFile(file: File, maxRows: number = 5): Promise<ExcelParseResult> {
    const result = await this.parseFile(file);
    
    if (result.success && result.data) {
      return {
        ...result,
        data: result.data.slice(0, maxRows),
        totalRows: result.data.length // 保持总行数不变
      };
    }
    
    return result;
  }

  /**
   * 检查Excel文件是否包含预期的字段
   */
  static checkRequiredFields(headers: string[], requiredFields: string[]): {
    hasRequired: boolean;
    missingFields: string[];
    foundFields: string[];
  } {
    const headerSet = new Set(headers.map(h => h.toLowerCase().trim()));
    const foundFields: string[] = [];
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (headerSet.has(field.toLowerCase().trim())) {
        foundFields.push(field);
      } else {
        missingFields.push(field);
      }
    }

    return {
      hasRequired: missingFields.length === 0,
      missingFields,
      foundFields
    };
  }
}