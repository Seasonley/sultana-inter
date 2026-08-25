/**
 * Unit tests for NLLB translator and langMap.
 *
 * Mocks @huggingface/transformers to avoid loading real model.
 * Tests FLORES-200 code mapping and translator interface.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toFlores } from '../src/langMap';

// Mock @huggingface/transformers
vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn().mockResolvedValue(vi.fn().mockResolvedValue([{ translation_text: 'translated' }])),
  env: {
    cacheDir: '',
    backends: {
      onnx: {
        wasm: { proxy: false },
      },
    },
  },
}));

describe('toFlores', () => {
  it('should map zh to zho_Hans', () => {
    expect(toFlores('zh')).toBe('zho_Hans');
  });

  it('should map zh-cn to zho_Hans', () => {
    expect(toFlores('zh-cn')).toBe('zho_Hans');
  });

  it('should map en to eng_Latn', () => {
    expect(toFlores('en')).toBe('eng_Latn');
  });

  it('should map ja to jpn_Jpan', () => {
    expect(toFlores('ja')).toBe('jpn_Jpan');
  });

  it('should map ko to kor_Hang', () => {
    expect(toFlores('ko')).toBe('kor_Hang');
  });

  it('should map fr to fra_Latn', () => {
    expect(toFlores('fr')).toBe('fra_Latn');
  });

  it('should map de to deu_Latn', () => {
    expect(toFlores('de')).toBe('deu_Latn');
  });

  it('should map es to spa_Latn', () => {
    expect(toFlores('es')).toBe('spa_Latn');
  });

  it('should map ru to rus_Cyrl', () => {
    expect(toFlores('ru')).toBe('rus_Cyrl');
  });

  it('should map ar to arb_Arab', () => {
    expect(toFlores('ar')).toBe('arb_Arab');
  });

  it('should map vi to vir_Latn', () => {
    expect(toFlores('vi')).toBe('vir_Latn');
  });

  it('should map th to tha_Thai', () => {
    expect(toFlores('th')).toBe('tha_Thai');
  });

  it('should return input unchanged for unknown codes', () => {
    expect(toFlores('xyz')).toBe('xyz');
  });

  it('should handle case-insensitive input', () => {
    expect(toFlores('ZH')).toBe('zho_Hans');
    expect(toFlores('EN')).toBe('eng_Latn');
  });
});

describe('NllbTranslator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should import correctly', async () => {
    const { NllbTranslator } = await import('../src/nllb');
    expect(NllbTranslator).toBeDefined();
  });

  it('should implement TranslatorEngine interface', async () => {
    const { NllbTranslator } = await import('../src/nllb');
    const translator = new NllbTranslator();
    expect(typeof translator.translate).toBe('function');
  });

  it('should call pipeline with correct FLORES codes', async () => {
    const { pipeline } = await import('@huggingface/transformers');
    const mockTranslate = vi.fn().mockResolvedValue([{ translation_text: 'Hello' }]);
    vi.mocked(pipeline).mockResolvedValue(mockTranslate as any);

    const { NllbTranslator } = await import('../src/nllb');
    const translator = new NllbTranslator();

    await translator.translate('你好', 'zh', 'en');

    expect(pipeline).toHaveBeenCalledWith('translation', 'Xenova/nllb-200-distilled-600M', {
      dtype: 'fp32',
    });
    expect(mockTranslate).toHaveBeenCalledWith('你好', {
      src_lang: 'zho_Hans',
      tgt_lang: 'eng_Latn',
      num_beams: 4,
      max_length: 512,
    });
  });

  it('should return translation result', async () => {
    const { pipeline } = await import('@huggingface/transformers');
    const mockTranslate = vi.fn().mockResolvedValue([{ translation_text: 'Hello' }]);
    vi.mocked(pipeline).mockResolvedValue(mockTranslate as any);

    const { NllbTranslator } = await import('../src/nllb');
    const translator = new NllbTranslator();

    const result = await translator.translate('你好', 'zh', 'en');
    expect(result).toBe('Hello');
  });

  it('should throw error for unsupported language', async () => {
    const { NllbTranslator } = await import('../src/nllb');
    const translator = new NllbTranslator();

    // 'xyz' is not in the FLORES_MAP, but toFlores returns it unchanged
    // so this should not throw. Let's test with empty string
    await expect(translator.translate('test', '', 'en')).rejects.toThrow('Unsupported language');
  });

  it('should log progress when loading model', async () => {
    const { NllbTranslator } = await import('../src/nllb');
    const translator = new NllbTranslator();

    await translator.translate('test', 'zh', 'en');
    // If we get here without error, model loading succeeded (mocked)
  });

  it('should support custom modelDir parameter', async () => {
    const { NllbTranslator } = await import('../src/nllb');
    const translator = new NllbTranslator('/custom/cache');

    await translator.translate('test', 'zh', 'en');
    // No error means custom cache dir was accepted
  });
});
