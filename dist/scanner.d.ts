/**
 * Pipeline stage 1: Scanner
 *
 * Walks the project tree, applies include/exclude globs,
 * classifies files by framework, emits NDJSON log.
 */
import { I18nConfig, ScannedFile } from './types';
/**
 * Stage 1: Scan project and return classified files.
 */
export declare function scan(rootPath: string, conf: I18nConfig): ScannedFile[];
