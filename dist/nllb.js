"use strict";
/**
 * NLLB-200 translation engine.
 *
 * Uses Meta's No Language Left Behind (NLLB-200) distilled 600M model
 * via Hugging Face Transformers.js for on-device translation.
 *
 * Environment variables:
 * - SQUID_MODEL_DIR: local model cache directory
 * - HF_ENDPOINT: Hugging Face mirror endpoint
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NllbTranslator = void 0;
const transformers_1 = require("@huggingface/transformers");
const langMap_1 = require("./langMap");
const logger_1 = require("./logger");
// Model identifier
const MODEL_ID = 'Xenova/nllb-200-distilled-600M';
/**
 * NLLB-based translator engine.
 * Lazily loads the model on first use.
 */
class NllbTranslator {
    constructor(modelDir) {
        this.translator = null;
        this.modelDir = modelDir || process.env.SQUID_MODEL_DIR;
    }
    /**
     * Ensure the NLLB model is loaded.
     * Supports local cache via SQUID_MODEL_DIR and mirror via HF_ENDPOINT.
     */
    async ensureModel() {
        if (this.translator)
            return;
        // Use local model cache if configured
        if (this.modelDir) {
            transformers_1.env.cacheDir = this.modelDir;
        }
        // Support HF mirror endpoint
        const hfEndpoint = process.env.HF_ENDPOINT;
        if (hfEndpoint) {
            transformers_1.env.backends.onnx.wasm.proxy = false;
        }
        logger_1.logger.progress(`Loading NLLB model: ${MODEL_ID}...`);
        this.translator = await (0, transformers_1.pipeline)('translation', MODEL_ID, {
            dtype: 'fp32',
        });
        logger_1.logger.progress('NLLB model loaded.');
    }
    /**
     * Translate text from source language to target language.
     *
     * @param text - Text to translate
     * @param from - Source language short code (e.g. 'zh', 'en')
     * @param to - Target language short code (e.g. 'en', 'ja')
     * @returns Translated text
     */
    async translate(text, from, to) {
        await this.ensureModel();
        const srcLang = (0, langMap_1.toFlores)(from);
        const tgtLang = (0, langMap_1.toFlores)(to);
        if (!srcLang || !tgtLang) {
            throw new Error(`Unsupported language: ${!srcLang ? from : to}`);
        }
        const result = await this.translator(text, {
            src_lang: srcLang,
            tgt_lang: tgtLang,
            num_beams: 4,
            max_length: 512,
        });
        return result[0]?.translation_text || text;
    }
}
exports.NllbTranslator = NllbTranslator;
//# sourceMappingURL=nllb.js.map