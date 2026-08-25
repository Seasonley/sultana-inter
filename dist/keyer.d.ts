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
import { I18nConfig, ExtractedEntry, KeyedEntry } from './types';
import { TranslationMap } from './translator';
/**
 * Stage 4: Assign camelCase keys from English translations.
 *
 * At this point in the pipeline, entries have been translated.
 * entry.text contains the English translation (e.g. "[en]你好世界" in stub mode).
 * We generate camelCase keys from this text and update the translation map.
 */
export declare function key(entries: ExtractedEntry[], conf: I18nConfig, translationMap: TranslationMap, projectRoot?: string): Promise<KeyedEntry[]>;
