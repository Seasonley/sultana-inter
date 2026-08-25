/**
 * Pipeline stage 2: Extractor
 *
 * Dispatches to framework-specific extractors and aggregates results.
 */
import { I18nConfig, ScannedFile, ExtractedEntry } from './types';
/**
 * Stage 2: Extract hardcoded Chinese text from all scanned files.
 */
export declare function extract(files: ScannedFile[], rootPath: string, _conf: I18nConfig): ExtractedEntry[];
