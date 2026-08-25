/**
 * Pipeline stage 5: Translator
 *
 * Supports two modes:
 * - Stub mode (default): fast, deterministic placeholder translations for testing
 * - NLLB mode (SQUID_E2E_REAL=1): real translation via Meta's NLLB-200 model
 *
 * Stub behavior: for each text, returns `[lang]原文` (e.g. `[en]你好`).
 * NLLB behavior: uses @huggingface/transformers with Xenova/nllb-200-distilled-600M.
 */
import { I18nConfig, ExtractedEntry, TranslatorEngine } from './types';
export declare class StubTranslator implements TranslatorEngine {
    translate(text: string, from: string, to: string): Promise<string>;
}
export interface TranslationMap {
    [lang: string]: Record<string, string>;
}
/**
 * Stage 5: Translate all keyed entries to target languages.
 *
 * Uses the provided TranslatorEngine (StubTranslator by default,
 * NLLBTranslator when SQUID_E2E_REAL=1).
 *
 * Progress logging format:
 * {"stage":"translate","lang":"en","batch":1,"total":847,"model":"nllb-200","ms":3400}
 */
export declare function translate(entries: ExtractedEntry[], conf: I18nConfig, engine?: TranslatorEngine): Promise<TranslationMap>;
