/**
 * Pipeline stage 6: Writer
 *
 * Writes locale JSON files, generates framework-specific runtime init files,
 * and performs incremental merge on existing locale files.
 */
import { I18nConfig, KeyedEntry, WrittenFile } from './types';
import { TranslationMap } from './translator';
export interface WriteResult {
    written: WrittenFile[];
}
/**
 * Stage 6: Write all output files.
 */
export declare function write(rootPath: string, conf: I18nConfig, keyedEntries: KeyedEntry[], translationMap: TranslationMap, rewritten: Map<string, string>, dryRun?: boolean): WriteResult;
