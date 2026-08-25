import { ExtractedEntry } from '../types';
/**
 * 从 Angular HTML 模板或包含 @Component 内联模板的 TypeScript 文件中
 * 提取硬编码的中文文本。
 *
 * @param filePath  文件绝对路径
 * @param relPath   相对于项目根目录的相对路径
 * @param content   文件的文本内容
 * @returns         ExtractedEntry 数组
 */
export declare function extractAngular(filePath: string, relPath: string, content: string): ExtractedEntry[];
