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

import { pipeline, env } from '@huggingface/transformers';
import { toFlores } from './langMap';
import { logger } from './logger';
import { TranslatorEngine } from './types';

// Model identifier
const MODEL_ID = 'Xenova/nllb-200-distilled-600M';

/**
 * NLLB-based translator engine.
 * Lazily loads the model on first use.
 */
export class NllbTranslator implements TranslatorEngine {
  private translator: any = null;
  private modelDir?: string;

  constructor(modelDir?: string) {
    this.modelDir = modelDir || process.env.SQUID_MODEL_DIR;
  }

  /**
   * Ensure the NLLB model is loaded.
   * Supports local cache via SQUID_MODEL_DIR and mirror via HF_ENDPOINT.
   */
  private async ensureModel(): Promise<void> {
    if (this.translator) return;

    // Use local model cache if configured
    if (this.modelDir) {
      env.cacheDir = this.modelDir;
    }

    // Support HF mirror endpoint
    const hfEndpoint = process.env.HF_ENDPOINT;
    if (hfEndpoint) {
      env.backends.onnx.wasm.proxy = false;
    }

    logger.progress(`Loading NLLB model: ${MODEL_ID}...`);
    this.translator = await pipeline('translation', MODEL_ID, {
      dtype: 'fp32',
    });
    logger.progress('NLLB model loaded.');
  }

  /**
   * Translate text from source language to target language.
   *
   * @param text - Text to translate
   * @param from - Source language short code (e.g. 'zh', 'en')
   * @param to - Target language short code (e.g. 'en', 'ja')
   * @returns Translated text
   */
  async translate(text: string, from: string, to: string): Promise<string> {
    await this.ensureModel();

    const srcLang = toFlores(from);
    const tgtLang = toFlores(to);

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
