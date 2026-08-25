import { ExtractedEntry } from '../types';
/**
 * 从 React/TSX/JSX 文件中提取硬编码的中文文本
 */
export declare function extractReact(filePath: string, relPath: string, content: string): ExtractedEntry[];
