/**
 * LLM keyer — calls an OpenAI-compatible API to generate semantic key names.
 *
 * Features:
 *  - Batches entries to stay within context limits (default 100/batch)
 *  - Caches results to `.sultana/keymap.json` to avoid redundant API calls
 *  - Falls back to deterministic keys on error or missing credentials
 */

import * as fs from 'fs';
import * as path from 'path';
import { SemanticKeyer } from './types';
import { logger } from './logger';

// ── Environment variable helpers ────────────────────────────────

function getApiKey(): string | undefined {
  return process.env.SQUID_LLM_API_KEY || process.env.OPENAI_API_KEY;
}

function getBaseUrl(): string {
  return process.env.SQUID_LLM_API || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
}

function hasCredentials(): boolean {
  return !!getApiKey();
}

// ── Prompt template ─────────────────────────────────────────────

function buildPrompt(
  entries: Array<{ oldKey: string; text: string }>
): string {
  const list = entries
    .map((e, i) => `  ${i + 1}. oldKey="${e.oldKey}" text="${e.text}"`)
    .join('\n');

  return `You are an i18n key naming assistant. Given the following Chinese text entries with their current keys, generate short, descriptive semantic keys for each entry.

Rules:
- Use dot-separated lowercase English (e.g. "home.greeting", "login.submit_button")
- Do NOT translate the text; only generate the key name
- Keep keys concise (2-4 segments)
- Do not reuse keys
- Output ONLY a valid JSON object mapping oldKey to the new semantic key
- No markdown, no explanation, just JSON

Entries:
${list}

Output format: {"oldKey1": "semantic.key1", "oldKey2": "semantic.key2"}`;
}

// ── Cache helpers ───────────────────────────────────────────────

function getCachePath(projectRoot: string): string {
  return path.join(projectRoot, '.sultana', 'keymap.json');
}

function loadCache(projectRoot: string): Map<string, string> | null {
  const cachePath = getCachePath(projectRoot);
  if (!fs.existsSync(cachePath)) return null;

  try {
    const raw = fs.readFileSync(cachePath, 'utf-8');
    const obj = JSON.parse(raw);
    return new Map(Object.entries(obj));
  } catch {
    return null;
  }
}

function saveCache(projectRoot: string, map: Map<string, string>): void {
  const cachePath = getCachePath(projectRoot);
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const obj: Record<string, string> = {};
  for (const [k, v] of map) {
    obj[k] = v;
  }
  fs.writeFileSync(cachePath, JSON.stringify(obj, null, 2));
}

// ── Batch splitter ──────────────────────────────────────────────

export function splitBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

// ── LLM API call ───────────────────────────────────────────────

interface LlmChoice {
  message: { content: string };
}

interface LlmResponse {
  choices: LlmChoice[];
}

async function callLlm(
  prompt: string,
  model: string
): Promise<string> {
  const apiKey = getApiKey();
  const baseUrl = getBaseUrl();

  if (!apiKey) {
    throw new Error('No LLM API key found in environment variables');
  }

  const url = `${baseUrl}/chat/completions`;
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`LLM API returned ${response.status}: ${text}`);
  }

  const data = (await response.json()) as LlmResponse;
  return data.choices[0].message.content;
}

// ── Parse LLM JSON response ────────────────────────────────────

function parseLlmResponse(raw: string): Map<string, string> {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  const obj = JSON.parse(cleaned);
  return new Map(Object.entries(obj) as [string, string][]);
}

// ── LlmKeyer class ─────────────────────────────────────────────

export interface LlmKeyerOptions {
  projectRoot: string;
  batchSize?: number;
  model?: string;
}

export class LlmKeyer implements SemanticKeyer {
  private projectRoot: string;
  private batchSize: number;
  private model: string;

  constructor(opts: LlmKeyerOptions) {
    this.projectRoot = opts.projectRoot;
    this.batchSize = opts.batchSize || 100;
    this.model = opts.model || 'gpt-4o-mini';
  }

  /** Exposed for testing: whether credentials exist. */
  static hasCredentials = hasCredentials;

  /**
   * Map old keys to semantic keys via LLM.
   * Reads from cache first; calls LLM in batches for misses; saves cache.
   */
  async mapKeys(
    entries: Array<{ oldKey: string; text: string }>
  ): Promise<Map<string, string>> {
    // Load existing cache
    const cache = loadCache(this.projectRoot) || new Map<string, string>();

    // Find entries not yet cached
    const uncached = entries.filter((e) => !cache.has(e.oldKey));

    if (uncached.length === 0) {
      logger.ndjson({
        stage: 'llm-keyer',
        event: 'cache-hit',
        total: entries.length,
        cached: entries.length,
      });
      return new Map(entries.map((e) => [e.oldKey, cache.get(e.oldKey)!]));
    }

    logger.ndjson({
      stage: 'llm-keyer',
      event: 'cache-miss',
      total: entries.length,
      uncached: uncached.length,
    });

    // Split into batches and call LLM
    const batches = splitBatches(uncached, this.batchSize);
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const prompt = buildPrompt(batch);

      try {
        const raw = await callLlm(prompt, this.model);
        const batchResult = parseLlmResponse(raw);

        for (const [oldKey, newKey] of batchResult) {
          cache.set(oldKey, newKey);
        }

        logger.ndjson({
          stage: 'llm-keyer',
          event: 'batch-done',
          batch: i + 1,
          totalBatches: batches.length,
          entries: batch.length,
        });
      } catch (err) {
        // On error, fall back to deterministic keys for this batch
        logger.log('warn', 'llm-keyer', `Batch ${i + 1}/${batches.length} failed: ${err}. Falling back to deterministic keys for this batch.`);

        for (const entry of batch) {
          cache.set(entry.oldKey, entry.oldKey);
        }
      }
    }

    // Save cache
    saveCache(this.projectRoot, cache);

    // Return results for all requested entries
    const result = new Map<string, string>();
    for (const entry of entries) {
      result.set(entry.oldKey, cache.get(entry.oldKey) || entry.oldKey);
    }

    return result;
  }
}
