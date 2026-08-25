/**
 * Pipeline stage 4: Annotator
 *
 * Rewrites source files by replacing Chinese text with framework-native call sites.
 * Handles imports, template literals with variables, string vs JSX text, etc.
 */
import { I18nConfig, KeyedEntry } from './types';
interface AnnotateResult {
    /** Map from absolute file path to rewritten content */
    rewritten: Map<string, string>;
    /** Files that were modified */
    modifiedFiles: string[];
}
/**
 * Stage 4: Rewrite source files with i18n call sites.
 *
 * For each file, groups entries by file, sorts by range descending
 * (to apply replacements from end to start, preserving earlier offsets),
 * and applies the replacements.
 */
export declare function annotate(keyedEntries: KeyedEntry[], conf: I18nConfig): AnnotateResult;
export {};
