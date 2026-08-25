/**
 * Core type definitions for sultana-inter pipeline.
 *
 * Each pipeline stage receives the output of the previous stage
 * and emits NDJSON log lines via the shared Logger.
 */
export type Framework = 'vue' | 'react' | 'angular';
export interface I18nConfig {
    /** Glob patterns to include */
    include: string[];
    /** Glob patterns to exclude */
    exclude: string[];
    /** Project-level default framework for ambiguous files */
    framework?: Framework;
    /** Source language short code (default: 'zh') */
    source?: string;
    /** Target language short codes */
    to?: string[];
    /** Locale output path template, e.g. 'src/i18n/{{lang}}.json' */
    localePath?: string;
    /** Runtime init file path, e.g. 'src/i18n/index.ts' */
    initPath?: string;
    /** Semantic key naming (requires LLM) */
    semanticKeys?: boolean;
    /** Explicitly disable semantic key naming (overrides semanticKeys) */
    noSemantic?: boolean;
    /** Skip files whose framework cannot be determined */
    skipAmbiguous?: boolean;
}
export interface ScannedFile {
    /** Absolute path */
    absPath: string;
    /** Relative path from project root */
    relPath: string;
    /** Detected or configured framework */
    framework: Framework;
    /** File extension (e.g. '.vue', '.tsx', '.html') */
    ext: string;
}
export type CallSiteType = 'string' | 'jsx-text' | 'jsx-attr' | 'vue-template' | 'vue-attr' | 'angular-html' | 'angular-attr' | 'angular-inline';
export interface ExtractedEntry {
    /** Source file absolute path */
    file: string;
    /** Relative path from project root */
    relPath: string;
    /** Original key (deterministic, e.g. 'src/views/Home.1') */
    originalKey: string;
    /** The Chinese text content */
    text: string;
    /** Character range in source [start, end) */
    range: [number, number];
    /** How the call site should appear */
    callSiteType: CallSiteType;
    /** Target framework */
    framework: Framework;
    /** Whether the text was in a string literal (needs quote removal) */
    isString: boolean;
    /** Template literal variables, if any */
    vars?: Array<{
        name: string;
        expr: string;
    }>;
}
export interface KeyedEntry extends ExtractedEntry {
    /** Final key (may be semantic if LLM enabled) */
    key: string;
}
export interface TranslationUnit {
    key: string;
    text: string;
}
export interface TranslatorEngine {
    translate(text: string, from: string, to: string): Promise<string>;
}
export interface SemanticKeyer {
    mapKeys(entries: Array<{
        oldKey: string;
        text: string;
    }>): Promise<Map<string, string>>;
}
export interface WrittenFile {
    absPath: string;
    type: 'locale' | 'init' | 'source';
    lang?: string;
}
export interface PipelineSummary {
    filesScanned: number;
    filesProcessed: number;
    entriesExtracted: number;
    keysGenerated: number;
    translationsGenerated: number;
    filesWritten: number;
}
