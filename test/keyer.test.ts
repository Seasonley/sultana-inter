/**
 * Tests for keyer stage: DeterministicKeyer, LlmKeyer, and key() orchestrator.
 *
 * Covers:
 *  - DeterministicKeyer camelCase generation from English text
 *  - LlmKeyer: prompt format, batch processing, cache read/write, fallback on error
 *  - key() orchestrator: config-driven keyer selection, translation map remapping
 *  - splitBatches utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { DeterministicKeyer, toCamelCase } from '../src/keyer-deterministic';
import { LlmKeyer, splitBatches } from '../src/keyer-llm';
import { key } from '../src/keyer';
import type { ExtractedEntry, I18nConfig } from '../src/types';
import type { TranslationMap } from '../src/translator';

// ── Mock logger ─────────────────────────────────────────────────

vi.mock('../src/logger', () => ({
  logger: {
    ndjson: vi.fn(),
    progress: vi.fn(),
    log: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
  },
}));

// ── Helpers ─────────────────────────────────────────────────────

function makeTmpDir(): string {
  const base = path.resolve(__dirname, '..', '.test-tmp');
  fs.mkdirSync(base, { recursive: true });
  return fs.mkdtempSync(path.join(base, 'keyer-test-'));
}

function cleanup(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function makeEntry(
  overrides: Partial<ExtractedEntry> & { originalKey: string; text: string }
): ExtractedEntry {
  return {
    file: '/project/src/App.vue',
    relPath: 'src/App.vue',
    range: [0, 10],
    callSiteType: 'vue-template',
    framework: 'vue',
    isString: false,
    ...overrides,
  };
}

function makeTranslationMap(
  entries: Array<{ originalKey: string; enText: string }>,
  lang: string = 'en'
): TranslationMap {
  const map: TranslationMap = {};
  map[lang] = {};
  for (const e of entries) {
    map[lang][e.originalKey] = e.enText;
  }
  return map;
}

// ── toCamelCase tests ──────────────────────────────────────────

describe('toCamelCase', () => {
  it('converts "Hello World" to "helloWorld"', () => {
    expect(toCamelCase('Hello World')).toBe('helloWorld');
  });

  it('converts "Welcome to the App" to "welcomeToTheApp"', () => {
    expect(toCamelCase('Welcome to the App')).toBe('welcomeToTheApp');
  });

  it('converts "User Login" to "userLogin"', () => {
    expect(toCamelCase('User Login')).toBe('userLogin');
  });

  it('converts "[en]你好世界" to "en你好世界" (stub output) — strips non-ASCII', () => {
    // Stub translator returns "[en]你好世界" — after stripping non-ASCII, we get "en"
    const result = toCamelCase('[en]你好世界');
    expect(result).toBe('en');
  });

  it('handles empty string', () => {
    expect(toCamelCase('')).toBe('');
  });

  it('handles single word', () => {
    expect(toCamelCase('Hello')).toBe('hello');
  });

  it('strips leading digits', () => {
    expect(toCamelCase('123abc')).toBe('abc');
  });
});

// ── DeterministicKeyer tests ────────────────────────────────────

describe('DeterministicKeyer', () => {
  it('generates camelCase keys from English text', async () => {
    const keyer = new DeterministicKeyer();
    const input = [
      { oldKey: 'src/App.1', text: 'Hello World' },
      { oldKey: 'src/App.2', text: 'Welcome to the App' },
    ];

    const result = await keyer.mapKeys(input);

    expect(result.size).toBe(2);
    expect(result.get('src/App.1')).toBe('helloWorld');
    expect(result.get('src/App.2')).toBe('welcomeToTheApp');
  });

  it('deduplicates keys with numeric suffix', async () => {
    const keyer = new DeterministicKeyer();
    const input = [
      { oldKey: 'a', text: 'Hello World' },
      { oldKey: 'b', text: 'Hello World' },
      { oldKey: 'c', text: 'Hello World' },
    ];

    const result = await keyer.mapKeys(input);

    expect(result.get('a')).toBe('helloWorld');
    expect(result.get('b')).toBe('helloWorld_2');
    expect(result.get('c')).toBe('helloWorld_3');
  });

  it('handles empty input', async () => {
    const keyer = new DeterministicKeyer();
    const result = await keyer.mapKeys([]);
    expect(result.size).toBe(0);
  });

  it('falls back to oldKey when text is empty', async () => {
    const keyer = new DeterministicKeyer();
    const input = [{ oldKey: 'src/App.1', text: '' }];
    const result = await keyer.mapKeys(input);
    // Falls back to oldKey stripped of non-alphanumeric
    expect(result.get('src/App.1')).toBe('srcApp1');
  });
});

// ── splitBatches tests ──────────────────────────────────────────

describe('splitBatches', () => {
  it('splits items into correct batch sizes', () => {
    const items = Array.from({ length: 250 }, (_, i) => `item-${i}`);
    const batches = splitBatches(items, 100);

    expect(batches.length).toBe(3);
    expect(batches[0].length).toBe(100);
    expect(batches[1].length).toBe(100);
    expect(batches[2].length).toBe(50);
  });

  it('returns single batch when items fit', () => {
    const items = [1, 2, 3];
    const batches = splitBatches(items, 100);
    expect(batches).toEqual([[1, 2, 3]]);
  });

  it('handles empty input', () => {
    const batches = splitBatches([], 100);
    expect(batches).toEqual([]);
  });
});

// ── LlmKeyer tests ─────────────────────────────────────────────

describe('LlmKeyer', () => {
  let tmpDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    cleanup(tmpDir);
    vi.restoreAllMocks();
  });

  it('calls LLM API with correct prompt format', async () => {
    process.env.SQUID_LLM_API_KEY = 'test-key';
    process.env.SQUID_LLM_API = 'http://localhost:9999';

    const mockResponse = {
      choices: [{ message: { content: '{"src/App.1": "home.greeting"}' } }],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const keyer = new LlmKeyer({ projectRoot: tmpDir, batchSize: 10 });
    const input = [{ oldKey: 'src/App.1', text: 'Hello World' }];

    const result = await keyer.mapKeys(input);

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:9999/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      })
    );

    // Verify prompt content
    const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    const prompt = callBody.messages[0].content;
    expect(prompt).toContain('oldKey="src/App.1"');
    expect(prompt).toContain('text="Hello World"');
    expect(prompt).toContain('JSON');
    expect(callBody.model).toBe('gpt-4o-mini');

    // Verify result
    expect(result.get('src/App.1')).toBe('home.greeting');
  });

  it('writes cache to .sultana/keymap.json', async () => {
    process.env.SQUID_LLM_API_KEY = 'test-key';
    process.env.SQUID_LLM_API = 'http://localhost:9999';

    const mockResponse = {
      choices: [{ message: { content: '{"src/App.1": "home.greeting"}' } }],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const keyer = new LlmKeyer({ projectRoot: tmpDir });
    await keyer.mapKeys([{ oldKey: 'src/App.1', text: 'Hello World' }]);

    const cachePath = path.join(tmpDir, '.sultana', 'keymap.json');
    expect(fs.existsSync(cachePath)).toBe(true);

    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    expect(cache['src/App.1']).toBe('home.greeting');
  });

  it('reads from cache on second call (no fetch)', async () => {
    process.env.SQUID_LLM_API_KEY = 'test-key';
    process.env.SQUID_LLM_API = 'http://localhost:9999';

    const mockResponse = {
      choices: [{ message: { content: '{"src/App.1": "home.greeting"}' } }],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const keyer = new LlmKeyer({ projectRoot: tmpDir });

    // First call — hits API
    await keyer.mapKeys([{ oldKey: 'src/App.1', text: 'Hello World' }]);
    expect(fetchSpy).toHaveBeenCalledOnce();

    // Clear spy call count
    fetchSpy.mockClear();

    // Second call — should use cache
    const result = await keyer.mapKeys([{ oldKey: 'src/App.1', text: 'Hello World' }]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.get('src/App.1')).toBe('home.greeting');
  });

  it('falls back to deterministic keys when API call fails', async () => {
    process.env.SQUID_LLM_API_KEY = 'test-key';
    process.env.SQUID_LLM_API = 'http://localhost:9999';

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const keyer = new LlmKeyer({ projectRoot: tmpDir });
    const input = [
      { oldKey: 'src/App.1', text: 'Hello World' },
      { oldKey: 'src/App.2', text: 'Welcome' },
    ];

    const result = await keyer.mapKeys(input);

    // On error, keys fall back to oldKey
    expect(result.get('src/App.1')).toBe('src/App.1');
    expect(result.get('src/App.2')).toBe('src/App.2');
  });

  it('splits large input into batches', async () => {
    process.env.SQUID_LLM_API_KEY = 'test-key';
    process.env.SQUID_LLM_API = 'http://localhost:9999';

    const batchSize = 5;
    const entries = Array.from({ length: 12 }, (_, i) => ({
      oldKey: `src/App.${i}`,
      text: `Text ${i}`,
    }));

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(
                Object.fromEntries(
                  entries.slice(0, batchSize).map((e) => [e.oldKey, `key.${e.oldKey}`])
                )
              ),
            },
          },
        ],
      }),
    } as any));

    const keyer = new LlmKeyer({ projectRoot: tmpDir, batchSize });
    const result = await keyer.mapKeys(entries);

    // 12 entries / batch 5 = 3 batches
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result.size).toBe(12);
  });

  it('uses OPENAI_API_KEY and OPENAI_BASE_URL as fallback env vars', async () => {
    delete process.env.SQUID_LLM_API_KEY;
    delete process.env.SQUID_LLM_API;
    process.env.OPENAI_API_KEY = 'openai-key';
    process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1';

    const mockResponse = {
      choices: [{ message: { content: '{"src/App.1": "home.greeting"}' } }],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const keyer = new LlmKeyer({ projectRoot: tmpDir });
    await keyer.mapKeys([{ oldKey: 'src/App.1', text: 'Hello World' }]);

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer openai-key',
        }),
      })
    );

    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
  });

  it('uses custom model when specified', async () => {
    process.env.SQUID_LLM_API_KEY = 'test-key';
    process.env.SQUID_LLM_API = 'http://localhost:9999';

    const mockResponse = {
      choices: [{ message: { content: '{"src/App.1": "home.greeting"}' } }],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const keyer = new LlmKeyer({ projectRoot: tmpDir, model: 'gpt-4o' });
    await keyer.mapKeys([{ oldKey: 'src/App.1', text: 'Hello World' }]);

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(callBody.model).toBe('gpt-4o');
  });

  it('handles markdown-wrapped JSON responses', async () => {
    process.env.SQUID_LLM_API_KEY = 'test-key';
    process.env.SQUID_LLM_API = 'http://localhost:9999';

    const mockResponse = {
      choices: [
        {
          message: {
            content: '```json\n{"src/App.1": "home.greeting"}\n```',
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const keyer = new LlmKeyer({ projectRoot: tmpDir });
    const result = await keyer.mapKeys([{ oldKey: 'src/App.1', text: 'Hello World' }]);

    expect(result.get('src/App.1')).toBe('home.greeting');
  });
});

// ── key() orchestrator tests ────────────────────────────────────

describe('key() orchestrator', () => {
  let tmpDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    cleanup(tmpDir);
  });

  it('generates camelCase keys from English translation', async () => {
    const entries = [makeEntry({ originalKey: 'src/App.1', text: '你好世界' })];
    const conf: I18nConfig = { include: [], exclude: [] };
    const translationMap = makeTranslationMap([
      { originalKey: 'src/App.1', enText: 'Hello World' },
    ]);

    const result = await key(entries, conf, translationMap, tmpDir);

    expect(result[0].key).toBe('helloWorld');
  });

  it('falls back to deterministic when noSemantic is true', async () => {
    process.env.SQUID_LLM_API_KEY = 'test-key';

    const entries = [makeEntry({ originalKey: 'src/App.1', text: '你好世界' })];
    const conf: I18nConfig = {
      include: [],
      exclude: [],
      semanticKeys: true,
      noSemantic: true,
    };
    const translationMap = makeTranslationMap([
      { originalKey: 'src/App.1', enText: 'Hello World' },
    ]);

    const result = await key(entries, conf, translationMap, tmpDir);

    expect(result[0].key).toBe('helloWorld');
  });

  it('falls back to deterministic when semanticKeys is true but no credentials', async () => {
    delete process.env.SQUID_LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const entries = [makeEntry({ originalKey: 'src/App.1', text: '你好世界' })];
    const conf: I18nConfig = { include: [], exclude: [], semanticKeys: true };
    const translationMap = makeTranslationMap([
      { originalKey: 'src/App.1', enText: 'Hello World' },
    ]);

    const result = await key(entries, conf, translationMap, tmpDir);

    expect(result[0].key).toBe('helloWorld');
  });

  it('uses LLM keyer when semanticKeys is true and credentials exist', async () => {
    process.env.SQUID_LLM_API_KEY = 'test-key';
    process.env.SQUID_LLM_API = 'http://localhost:9999';

    const mockResponse = {
      choices: [
        { message: { content: '{"src/App.1": "home.greeting"}' } },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const entries = [makeEntry({ originalKey: 'src/App.1', text: '你好世界' })];
    const conf: I18nConfig = { include: [], exclude: [], semanticKeys: true };
    const translationMap = makeTranslationMap([
      { originalKey: 'src/App.1', enText: 'Hello World' },
    ]);

    const result = await key(entries, conf, translationMap, tmpDir);

    expect(result[0].key).toBe('home.greeting');
  });

  it('updates translation map with new keys', async () => {
    const entries = [
      makeEntry({ originalKey: 'src/App.1', text: '你好世界' }),
      makeEntry({ originalKey: 'src/App.2', text: '欢迎使用' }),
    ];
    const conf: I18nConfig = { include: [], exclude: [] };
    const translationMap = makeTranslationMap([
      { originalKey: 'src/App.1', enText: 'Hello World' },
      { originalKey: 'src/App.2', enText: 'Welcome' },
    ]);

    await key(entries, conf, translationMap, tmpDir);

    // Translation map should now use camelCase keys with original values
    expect(translationMap.en['helloWorld']).toBe('Hello World');
    expect(translationMap.en['welcome']).toBe('Welcome');
    // Old keys should be removed
    expect(translationMap.en['src/App.1']).toBeUndefined();
    expect(translationMap.en['src/App.2']).toBeUndefined();
  });

  it('preserves all entry fields after keying', async () => {
    const entries = [
      makeEntry({
        originalKey: 'src/App.1',
        text: '你好世界',
        file: '/project/src/App.vue',
        relPath: 'src/App.vue',
        range: [19, 23] as [number, number],
        callSiteType: 'vue-template',
        framework: 'vue',
        isString: false,
      }),
    ];
    const conf: I18nConfig = { include: [], exclude: [] };
    const translationMap = makeTranslationMap([
      { originalKey: 'src/App.1', enText: 'Hello World' },
    ]);

    const result = await key(entries, conf, translationMap, tmpDir);

    expect(result[0]).toMatchObject({
      originalKey: 'src/App.1',
      key: 'helloWorld',
      text: '你好世界',
      file: '/project/src/App.vue',
      relPath: 'src/App.vue',
      framework: 'vue',
    });
  });

  // ── Integration: simulated NLLB translations → camelCase keys ──
  it('produces meaningful camelCase keys from simulated English translations', async () => {
    // Simulate what NLLB would produce for common Chinese UI texts
    const zhToEn: Record<string, string> = {
      '你好世界': 'Hello World',
      '欢迎使用': 'Welcome',
      '点击这里': 'Click Here',
      '版权信息': 'Copyright Information',
      '按钮被点击': 'Button Clicked',
    };

    const entries: ExtractedEntry[] = Object.entries(zhToEn).map(([zh, _en], i) => ({
      file: '/project/src/App.tsx',
      relPath: 'src/App.tsx',
      originalKey: `src/App.${i + 1}`,
      text: zh,
      range: [0, zh.length] as [number, number],
      callSiteType: 'jsx-text' as const,
      framework: 'react' as const,
      isString: false,
    }));

    const conf: I18nConfig = {
      source: 'zh',
      to: ['en'],
      include: [],
      exclude: [],
    };

    // Simulate translate stage: fill translationMap with English text
    const translationMap: TranslationMap = { en: {} };
    for (const entry of entries) {
      translationMap.en[entry.originalKey] = zhToEn[entry.text];
    }

    // Run keying stage
    const keyed = await key(entries, conf, translationMap, tmpDir);

    // Verify all keys are valid camelCase JS identifiers
    for (const entry of keyed) {
      expect(entry.key).toMatch(/^[a-zA-Z$][a-zA-Z0-9_$]*$/);
      expect(entry.key).not.toMatch(/\//);
    }

    // Verify specific camelCase mappings
    const keyMap = new Map(keyed.map((e) => [e.text, e.key]));
    expect(keyMap.get('你好世界')).toBe('helloWorld');
    expect(keyMap.get('欢迎使用')).toBe('welcome');
    expect(keyMap.get('点击这里')).toBe('clickHere');
    expect(keyMap.get('版权信息')).toBe('copyrightInformation');
    expect(keyMap.get('按钮被点击')).toBe('buttonClicked');

    // Verify translation map was remapped to camelCase keys
    expect(translationMap.en['helloWorld']).toBe('Hello World');
    expect(translationMap.en['welcome']).toBe('Welcome');
    expect(translationMap.en['clickHere']).toBe('Click Here');
    expect(translationMap.en['copyrightInformation']).toBe('Copyright Information');
    expect(translationMap.en['buttonClicked']).toBe('Button Clicked');

    // Old path-based keys should be gone
    expect(translationMap.en['src/App.1']).toBeUndefined();
    expect(translationMap.en['src/App.2']).toBeUndefined();
  });
});
