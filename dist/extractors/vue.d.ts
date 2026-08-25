/**
 * Vue SFC (Single File Component) Chinese text extractor.
 * Ported from ev-i18n's Babel AST + Vue SFC parsing logic.
 */
import { ExtractedEntry } from '../types';
/**
 * Extract hardcoded Chinese text from a Vue SFC file.
 */
export declare function extractVue(filePath: string, relPath: string, content: string): ExtractedEntry[];
