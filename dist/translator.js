"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StubTranslator = void 0;
exports.translate = translate;
const logger_1 = require("./logger");
const nllb_1 = require("./nllb");
// ── Stub translator ──────────────────────────────────────────────
class StubTranslator {
    async translate(text, from, to) {
        // Stub: prefix with target language code
        return `[${to}]${text}`;
    }
}
exports.StubTranslator = StubTranslator;
/**
 * Stage 5: Translate all keyed entries to target languages.
 *
 * Uses the provided TranslatorEngine (StubTranslator by default,
 * NLLBTranslator when SQUID_E2E_REAL=1).
 *
 * Progress logging format:
 * {"stage":"translate","lang":"en","batch":1,"total":847,"model":"nllb-200","ms":3400}
 */
async function translate(entries, conf, engine) {
    const startTime = Date.now();
    // Determine engine based on environment or provided engine
    let translator;
    if (engine) {
        translator = engine;
    }
    else if (process.env.SQUID_E2E_REAL === '1') {
        translator = new nllb_1.NllbTranslator();
        logger_1.logger.progress('Using NLLB translation engine (SQUID_E2E_REAL=1)');
    }
    else {
        translator = new StubTranslator();
    }
    const from = conf.source || 'zh';
    const targets = conf.to || ['en'];
    const totalEntries = entries.length;
    const translationMap = {};
    // Initialize map for each target language
    for (const lang of targets) {
        translationMap[lang] = {};
    }
    // Translate each entry with progress logging
    let translated = 0;
    const isNllb = translator instanceof nllb_1.NllbTranslator;
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
            logger_1.logger.ndjson({
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
    logger_1.logger.ndjson({
        stage: 'translate',
        event: 'done',
        entries: entries.length,
        languages: targets,
        translated,
        model,
        ms: totalMs,
    });
    logger_1.logger.progress(`Translated ${translated} entries (${entries.length} x ${targets.length} langs) in ${totalMs}ms`);
    return translationMap;
}
//# sourceMappingURL=translator.js.map