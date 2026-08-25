/**
 * Core type definitions for sultana-inter pipeline.
 *
 * Each pipeline stage receives the output of the previous stage
 * and emits NDJSON log lines via the shared Logger.
 */

// ── Config ────────────────────────────────────────────────────────

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

// ── Scanner output ────────────────────────────────────────────────

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

// ── Extractor output ──────────────────────────────────────────────

export type CallSiteType =
  | 'string'        // StringLiteral replacement
  | 'jsx-text'      // JSX text child replacement
  | 'jsx-attr'      // JSX attribute value replacement
  | 'vue-template'  // Vue template text node
  | 'vue-attr'      // Vue template attribute
  | 'angular-html'    // Angular template text
  | 'angular-attr'    // Angular template attribute
  | 'angular-inline'; // Angular inline template in @Component decorator

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
  vars?: Array<{ name: string; expr: string }>;
}

// ── Keyer output ──────────────────────────────────────────────────

export interface KeyedEntry extends ExtractedEntry {
  /** Final key (may be semantic if LLM enabled) */
  key: string;
}

// ── Translator input / output ─────────────────────────────────────

export interface TranslationUnit {
  key: string;
  text: string;
}

export interface TranslatorEngine {
  translate(text: string, from: string, to: string): Promise<string>;
}

// ── Semantic key naming ───────────────────────────────────────────

export interface SemanticKeyer {
  mapKeys(
    entries: Array<{ oldKey: string; text: string }>
  ): Promise<Map<string, string>>;
}

// ── Writer output ─────────────────────────────────────────────────

export interface WrittenFile {
  absPath: string;
  type: 'locale' | 'init' | 'source';
  lang?: string;
}

// ── Pipeline summary ──────────────────────────────────────────────

export interface PipelineSummary {
  filesScanned: number;
  filesProcessed: number;
  entriesExtracted: number;
  keysGenerated: number;
  translationsGenerated: number;
  filesWritten: number;
}
