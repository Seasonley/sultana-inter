/**
 * Pipeline stage 4: Keyer (runs AFTER translate)
 *
 * Generates camelCase keys from English translation text.
 * Also updates the translation map with the new keys.
 *
 * - Deterministic: converts English text to camelCase (e.g. "Hello World" → "helloWorld")
 * - Semantic: calls LLM to generate descriptive keys (e.g. "home.greeting")
 *
 * Selection is driven by I18nConfig.semanticKeys / noSemantic flags
 * and whether LLM credentials are available in the environment.
 */

import { I18nConfig, ExtractedEntry, KeyedEntry, SemanticKeyer } from './types';
import { TranslationMap } from './translator';
import { logger } from './logger';
import { DeterministicKeyer } from './keyer-deterministic';
import { LlmKeyer } from './keyer-llm';

/**
 * Resolve which SemanticKeyer to use based on config and environment.
 */
function resolveKeyer(conf: I18nConfig, projectRoot: string): SemanticKeyer {
  // noSemantic explicitly disables semantic keying
  if (conf.noSemantic) {
    logger.log('info', 'keyer', 'Semantic keys disabled via noSemantic config');
    return new DeterministicKeyer();
  }

  // semanticKeys not enabled — use deterministic (camelCase from English)
  if (!conf.semanticKeys) {
    return new DeterministicKeyer();
  }

  // semanticKeys enabled — check for LLM credentials
  if (!LlmKeyer.hasCredentials()) {
    logger.log(
      'warn',
      'keyer',
      'semanticKeys enabled but no LLM credentials found (SQUID_LLM_API_KEY / OPENAI_API_KEY). Falling back to camelCase keys.'
    );
    return new DeterministicKeyer();
  }

  logger.log('info', 'keyer', 'Using LLM semantic keyer');
  return new LlmKeyer({ projectRoot });
}

/**
 * Stage 4: Assign camelCase keys from English translations.
 *
 * At this point in the pipeline, entries have been translated.
 * entry.text contains the English translation (e.g. "[en]你好世界" in stub mode).
 * We generate camelCase keys from this text and update the translation map.
 */
export async function key(
  entries: ExtractedEntry[],
  conf: I18nConfig,
  translationMap: TranslationMap,
  projectRoot?: string
): Promise<KeyedEntry[]> {
  const startTime = Date.now();

  const root = projectRoot || process.cwd();
  const keyer = resolveKeyer(conf, root);

  // Prepare input for keyer: { oldKey, text } pairs
  // text here is the English translation (from translationMap or entry.text)
  const input = entries.map((e) => {
    // Use the first target language translation if available
    const targetLang = conf.to?.[0] || 'en';
    const translatedText = translationMap[targetLang]?.[e.originalKey] || e.text;
    return { oldKey: e.originalKey, text: translatedText };
  });

  // Get key mapping: oldKey → camelCase key
  const keyMap = await keyer.mapKeys(input);

  // Apply mapping to entries
  const keyed: KeyedEntry[] = entries.map((entry) => ({
    ...entry,
    key: keyMap.get(entry.originalKey) || entry.originalKey,
  }));

  // Update translation map: remap all language entries from oldKey to new key
  const targets = conf.to || ['en'];
  for (const lang of targets) {
    if (!translationMap[lang]) continue;
    const oldMap = { ...translationMap[lang] };
    translationMap[lang] = {};
    for (const entry of keyed) {
      const translated = oldMap[entry.originalKey];
      if (translated !== undefined) {
        translationMap[lang][entry.key] = translated;
      }
    }
  }

  const isSemantic = conf.semanticKeys && !conf.noSemantic && LlmKeyer.hasCredentials();
  const ms = Date.now() - startTime;

  logger.ndjson({
    stage: 'keying',
    event: 'done',
    total: keyed.length,
    semantic: !!isSemantic,
    ms,
  });

  logger.progress(
    `Generated ${keyed.length} ${isSemantic ? 'semantic' : 'camelCase'} keys in ${ms}ms`
  );

  return keyed;
}
