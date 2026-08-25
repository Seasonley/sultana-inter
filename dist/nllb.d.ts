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
import { TranslatorEngine } from './types';
/**
 * NLLB-based translator engine.
 * Lazily loads the model on first use.
 */
export declare class NllbTranslator implements TranslatorEngine {
    private translator;
    private modelDir?;
    constructor(modelDir?: string);
    /**
     * Ensure the NLLB model is loaded.
     * Supports local cache via SQUID_MODEL_DIR and mirror via HF_ENDPOINT.
     */
    private ensureModel;
    /**
     * Translate text from source language to target language.
     *
     * @param text - Text to translate
     * @param from - Source language short code (e.g. 'zh', 'en')
     * @param to - Target language short code (e.g. 'en', 'ja')
     * @returns Translated text
     */
    translate(text: string, from: string, to: string): Promise<string>;
}
