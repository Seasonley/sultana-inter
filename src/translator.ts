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

import { I18nConfig, ExtractedEntry, KeyedEntry, TranslatorEngine, TranslationUnit } from './types';
import { toFlores } from './langMap';
import { logger } from './logger';
import { NllbTranslator } from './nllb';

// ── Stub translator ──────────────────────────────────────────────

export class StubTranslator implements TranslatorEngine {
  async translate(text: string, from: string, to: string): Promise<string> {
    // Stub: prefix with target language code
    return `[${to}]${text}`;
  }
}

// ── Translation map: key → { lang → translated text } ────────────

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
export async function translate(
  entries: ExtractedEntry[],
  conf: I18nConfig,
  engine?: TranslatorEngine
): Promise<TranslationMap> {
  const startTime = Date.now();
  
  // Determine engine based on environment or provided engine
  let translator: TranslatorEngine;
  if (engine) {
    translator = engine;
  } else if (process.env.SQUID_E2E_REAL === '1') {
    translator = new NllbTranslator();
    logger.progress('Using NLLB translation engine (SQUID_E2E_REAL=1)');
  } else {
    translator = new StubTranslator();
  }
  
  const from = conf.source || 'zh';
  const targets = conf.to || ['en'];
  const totalEntries = entries.length;

  const translationMap: TranslationMap = {};

  // Initialize map for each target language
  for (const lang of targets) {
    translationMap[lang] = {};
  }

  // Translate each entry with progress logging
  let translated = 0;
  const isNllb = translator instanceof NllbTranslator;
  const model = isNllb ? 'nllb-200' : 'stub';
  
  for (const entry of entries) {
    for (const lang of targets) {
      const batchStart = Date.now();
      const result = await translator.translate(entry.text, from, lang);
      // Use originalKey as temporary key; keyer will remap later
      translationMap[lang][entry.originalKey] = result;
      translated++;
      
      // Log progress per batch
      const ms = Date.now() - batchStart;
      logger.ndjson({
        stage: 'translate',
        lang,
        batch: translated,
        total: totalEntries * targets.length,
        model,
        ms,
      });
    }
  }

  const totalMs = Date.now() - startTime;
  logger.ndjson({
    stage: 'translate',
    event: 'done',
    entries: entries.length,
    languages: targets,
    translated,
    model,
    ms: totalMs,
  });

  logger.progress(
    `Translated ${translated} entries (${entries.length} x ${targets.length} langs) in ${totalMs}ms`
  );

  return translationMap;
}
