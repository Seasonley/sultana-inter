"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.key = key;
const logger_1 = require("./logger");
const keyer_deterministic_1 = require("./keyer-deterministic");
const keyer_llm_1 = require("./keyer-llm");
/**
 * Resolve which SemanticKeyer to use based on config and environment.
 */
function resolveKeyer(conf, projectRoot) {
    // noSemantic explicitly disables semantic keying
    if (conf.noSemantic) {
        logger_1.logger.log('info', 'keyer', 'Semantic keys disabled via noSemantic config');
        return new keyer_deterministic_1.DeterministicKeyer();
    }
    // semanticKeys not enabled — use deterministic (camelCase from English)
    if (!conf.semanticKeys) {
        return new keyer_deterministic_1.DeterministicKeyer();
    }
    // semanticKeys enabled — check for LLM credentials
    if (!keyer_llm_1.LlmKeyer.hasCredentials()) {
        logger_1.logger.log('warn', 'keyer', 'semanticKeys enabled but no LLM credentials found (SQUID_LLM_API_KEY / OPENAI_API_KEY). Falling back to camelCase keys.');
        return new keyer_deterministic_1.DeterministicKeyer();
    }
    logger_1.logger.log('info', 'keyer', 'Using LLM semantic keyer');
    return new keyer_llm_1.LlmKeyer({ projectRoot });
}
/**
 * Stage 4: Assign camelCase keys from English translations.
 *
 * At this point in the pipeline, entries have been translated.
 * entry.text contains the English translation (e.g. "[en]你好世界" in stub mode).
 * We generate camelCase keys from this text and update the translation map.
 */
async function key(entries, conf, translationMap, projectRoot) {
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
    const keyed = entries.map((entry) => ({
        ...entry,
        key: keyMap.get(entry.originalKey) || entry.originalKey,
    }));
    // Update translation map: remap all language entries from oldKey to new key
    const targets = conf.to || ['en'];
    for (const lang of targets) {
        if (!translationMap[lang])
            continue;
        const oldMap = { ...translationMap[lang] };
        translationMap[lang] = {};
        for (const entry of keyed) {
            const translated = oldMap[entry.originalKey];
            if (translated !== undefined) {
                translationMap[lang][entry.key] = translated;
            }
        }
    }
    const isSemantic = conf.semanticKeys && !conf.noSemantic && keyer_llm_1.LlmKeyer.hasCredentials();
    const ms = Date.now() - startTime;
    logger_1.logger.ndjson({
        stage: 'keying',
        event: 'done',
        total: keyed.length,
        semantic: !!isSemantic,
        ms,
    });
    logger_1.logger.progress(`Generated ${keyed.length} ${isSemantic ? 'semantic' : 'camelCase'} keys in ${ms}ms`);
    return keyed;
}
//# sourceMappingURL=keyer.js.map