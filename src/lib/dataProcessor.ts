import { TiktokRawData } from './database';

// 字段映射配置 - 基于用户提供的normalizeRawData逻辑
const FIELD_MAPPINGS: Record<string, string[]> = {
  is_selected: ["是否选择", "选择", "is_selected"],
  serial_number: ["序号", "serial_number", "number"],
  work_id: ["作品id", "作品ID", "work_id", "id"],
  work_type: ["作品类型", "work_type", "type"],
  extract_type: ["提取类型", "extract_type"],
  search_keyword: ["搜索关键词", "search_keyword", "keyword"],
  author: ["作品作者", "作者", "author", "账号名", "用户名"],
  author_fans_count: [
    "作者粉丝数量",
    "粉丝数量",
    "author_fans_count",
    "fans",
  ],
  work_title: ["作品标题", "标题", "work_title", "title"],
  play_count: ["播放量", "观看量", "play_count", "views"],
  like_count: ["点赞量", "点赞数", "like_count", "likes"],
  comment_count: ["评论量", "评论数", "comment_count", "comments"],
  collect_count: ["收藏量", "收藏数", "collect_count", "collects"],
  share_count: ["分享量", "分享数", "share_count", "shares"],
  work_quality: ["作品质量", "work_quality", "quality"],
  work_duration: ["作品时长", "时长", "work_duration", "duration"],
  work_url: ["作品网址", "网址", "work_url", "url", "链接"],
  publish_time: ["发布时间", "时间", "publish_time", "create_time"],
  author_homepage: ["作者主页", "主页", "author_homepage", "homepage"],
  author_homepage_note: ["主页备注", "author_homepage_note"],
  work_note: ["作品备注", "备注", "work_note", "note"],
  author_uid: ["作者uid", "author_uid", "uid"],
  author_sec_uid: ["作者secUid", "author_sec_uid", "secUid"],
  cover_url: ["封面网址", "封面", "cover_url", "cover"],
  disable_download: ["DisableDownload", "disable_download"],
  video_source_url: ["视频源网址", "video_source_url"],
  image_download_url: ["图文下载网址", "image_download_url"],
  image_music_download_url: ["图文音乐下载网址", "image_music_download_url"],
  video_id: ["video_id", "视频id", "视频ID"],
  work_duration_seconds: [
    "作品时长秒",
    "work_duration_seconds",
    "duration_seconds",
  ],
  topic_content: ["话题内容", "topic_content", "topics"],
  download_status: ["下载状态", "download_status", "status"],
  save_path: ["保存路径", "save_path", "path"],
  is_voice_transcribed: ["是否已经语音转写文案", "is_voice_transcribed"],
};

/**
 * Excel日期解析函数
 */
function parseExcelDate(value: any): Date | null {
  if (!value) return null;
  
  try {
    // 如果已经是Date对象
    if (value instanceof Date) {
      return value;
    }
    
    // Excel序列号转日期 (Excel从1900年1月1日开始计算)
    if (typeof value === 'number') {
      // Excel日期序列号转换
      const excelEpoch = new Date(1899, 11, 30); // Excel起始日期
      const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
      return date;
    }
    
    // 字符串日期解析
    if (typeof value === 'string') {
      // 标准格式：2025-09-07 05:27:12
      const standardFormat = /^\d{4}-\d{2}-\d{2}[\s\T]\d{2}:\d{2}:\d{2}$/;
      if (standardFormat.test(value)) {
        return new Date(value);
      }
      
      // 其他常见格式
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Date parsing error:', error);
    return null;
  }
}

/**
 * 数据映射和转换器类
 */
export class DataMapper {
  
  /**
   * 标准化原始数据行 - 基于用户提供的normalizeRawData逻辑
   */
  static normalizeRawData(row: any): TiktokRawData {
    const data: Partial<TiktokRawData> = {};

    // 遍历所有字段映射规则
    for (const [field, possibleKeys] of Object.entries(FIELD_MAPPINGS)) {
      for (const key of possibleKeys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
          // 日期字段特殊处理
          if (field === "publish_time") {
            data[field as keyof TiktokRawData] = parseExcelDate(row[key]) as any;
          } 
          // 数值字段处理
          else if ([
            "play_count",
            "like_count", 
            "comment_count",
            "collect_count",
            "share_count",
            "author_fans_count",
            "work_duration_seconds",
          ].includes(field)) {
            const numValue = typeof row[key] === "number" 
              ? row[key] 
              : parseInt(row[key]?.toString().replace(/[^\d]/g, "") || "0");
            data[field as keyof TiktokRawData] = (isNaN(numValue) ? 0 : numValue) as any;
          } 
          // 布尔字段处理
          else if ([
            "is_selected", 
            "disable_download", 
            "is_voice_transcribed"
          ].includes(field)) {
            data[field as keyof TiktokRawData] = Boolean(row[key]) as any;
          } 
          // 字符串字段处理
          else {
            data[field as keyof TiktokRawData] = String(row[key]).trim() as any;
          }
          break; // 找到匹配的字段后跳出内层循环
        }
      }
    }

    return data as TiktokRawData;
  }

  /**
   * 批量处理Excel数据行
   */
  static processExcelRows(rows: any[]): TiktokRawData[] {
    const processedData: TiktokRawData[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      try {
        const normalizedRow = this.normalizeRawData(rows[i]);
        
        // 基本验证：至少需要有work_id或author
        if (normalizedRow.work_id || normalizedRow.author) {
          processedData.push(normalizedRow);
        } else {
          console.warn(`Row ${i + 1} skipped: missing required fields`);
        }
      } catch (error) {
        console.error(`Error processing row ${i + 1}:`, error);
        throw new Error(`数据处理失败在第 ${i + 1} 行: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return processedData;
  }

  /**
   * 验证Excel表头是否包含必要字段
   */
  static validateHeaders(headers: string[]): { valid: boolean; missingFields?: string[]; suggestions?: string[] } {
    const headerSet = new Set(headers.map(h => h.trim().toLowerCase()));
    const foundFields = new Set<string>();
    
    // 检查每个数据库字段是否有对应的Excel列
    for (const [dbField, excelColumns] of Object.entries(FIELD_MAPPINGS)) {
      for (const excelCol of excelColumns) {
        if (headerSet.has(excelCol.toLowerCase())) {
          foundFields.add(dbField);
          break;
        }
      }
    }

    // 至少需要包含一些基础字段
    const requiredFields = ['work_id', 'author', 'work_title'];
    const hasRequiredFields = requiredFields.some(field => foundFields.has(field));

    if (!hasRequiredFields) {
      return {
        valid: false,
        missingFields: requiredFields,
        suggestions: [
          '请确保Excel文件包含以下字段之一：',
          '- 作品id/作品ID/work_id',
          '- 作品作者/作者/author',
          '- 作品标题/标题/work_title'
        ]
      };
    }

    return { valid: true };
  }

  /**
   * 获取字段映射信息用于调试
   */
  static getFieldMappings(): Record<string, string[]> {
    return FIELD_MAPPINGS;
  }

  /**
   * 检查单行数据的完整性
   */
  static validateRow(data: TiktokRawData, rowIndex: number): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查基本字段
    if (!data.work_id && !data.video_id) {
      errors.push('缺少作品ID或视频ID');
    }

    if (!data.author) {
      errors.push('缺少作者信息');
    }

    // 检查数值字段
    const numberFields: (keyof TiktokRawData)[] = [
      'play_count', 'like_count', 'comment_count', 
      'collect_count', 'share_count', 'author_fans_count'
    ];

    for (const field of numberFields) {
      const value = data[field];
      if (value !== undefined && typeof value !== 'number') {
        errors.push(`字段 ${field} 应该是数值类型`);
      }
    }

    // 检查日期字段
    if (data.publish_time && !(data.publish_time instanceof Date)) {
      errors.push('发布时间格式不正确');
    }

    return {
      valid: errors.length === 0,
      errors: errors.map(error => `第${rowIndex + 1}行: ${error}`)
    };
  }
}

// 导出处理结果类型
export interface ProcessingResult {
  success: boolean;
  totalRows: number;
  processedRows: number;
  validRows: number;
  errors: string[];
  data?: TiktokRawData[];
}

/**
 * Excel数据处理器主类
 */
export class ExcelDataProcessor {
  
  /**
   * 处理完整的Excel数据
   */
  static async processExcelData(rows: any[], headers: string[]): Promise<ProcessingResult> {
    try {
      // 1. 验证表头
      const headerValidation = DataMapper.validateHeaders(headers);
      if (!headerValidation.valid) {
        return {
          success: false,
          totalRows: rows.length,
          processedRows: 0,
          validRows: 0,
          errors: headerValidation.suggestions || ['表头验证失败']
        };
      }

      // 2. 处理数据行
      const processedData = DataMapper.processExcelRows(rows);
      
      // 3. 验证每行数据
      const validationErrors: string[] = [];
      const validData: TiktokRawData[] = [];
      
      for (let i = 0; i < processedData.length; i++) {
        const validation = DataMapper.validateRow(processedData[i], i);
        if (validation.valid) {
          validData.push(processedData[i]);
        } else {
          validationErrors.push(...validation.errors);
        }
      }

      // 如果有验证错误且错误率过高，返回失败
      if (validationErrors.length > 0 && validationErrors.length > processedData.length * 0.1) {
        return {
          success: false,
          totalRows: rows.length,
          processedRows: processedData.length,
          validRows: validData.length,
          errors: ['数据验证失败，错误率过高', ...validationErrors.slice(0, 5)]
        };
      }

      return {
        success: true,
        totalRows: rows.length,
        processedRows: processedData.length,
        validRows: validData.length,
        errors: validationErrors,
        data: validData
      };
      
    } catch (error) {
      return {
        success: false,
        totalRows: rows.length,
        processedRows: 0,
        validRows: 0,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }
}