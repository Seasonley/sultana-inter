/**
 * Ticket 08 — CLI stage control tests
 *
 * Tests for:
 * - --stage scan  : only scans, does not extract/write
 * - --stage extract: scans + extracts, does not write
 * - --stage translate: translates but does not write source files
 * - --from-json   : skips scan/extract, loads entries from JSON
 * - --dry-run     : produces intermediate files but does not modify source
 *
 * All CLI tests spawn the CLI as a child process to avoid importing
 * cli.ts (which calls main() at module top-level).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ── Helpers ────────────────────────────────────────────────────────

const CLI_PATH = path.resolve(__dirname, '..', 'src', 'cli.ts');

function makeTmpDir(): string {
  // Use the project's own .test-tmp directory to avoid Windows 8.3 short path
  // issues with os.tmpdir() (e.g., C:\Users\XIESHE~1\...).
  const base = path.resolve(__dirname, '..', '.test-tmp');
  fs.mkdirSync(base, { recursive: true });
  return fs.mkdtempSync(path.join(base, 'sultana-cli-test-'));
}

function cleanup(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

/**
 * Create a minimal project fixture with the given file structure.
 */
function createFixture(root: string, files: Record<string, string>) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
  }
}

/**
 * Create a Vue fixture with Chinese text for pipeline testing.
 */
function createVueFixture(root: string) {
  createFixture(root, {
    'src/App.vue': `<template>
  <div>你好世界</div>
</template>
<script setup>
const msg = '欢迎使用'
</script>`,
    'i18n.json': JSON.stringify({
      include: ['**/*.{vue,tsx,jsx,ts,js,html}'],
      exclude: ['**/node_modules/**'],
      source: 'zh',
      to: ['en'],
    }),
  });
}

/**
 * Run the CLI and return { exitCode, stdout, stderr }.
 * Throws on non-zero exit code unless checkExit is false.
 */
function runCli(
  args: string,
  cwd: string,
  opts?: { checkExit?: boolean; env?: NodeJS.ProcessEnv }
): { exitCode: number; stdout: string; stderr: string } {
  const cmd = `npx tsx "${CLI_PATH}" ${args}`;
  try {
    const stdout = execSync(cmd, {
      cwd,
      encoding: 'utf-8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...opts?.env },
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err: any) {
    return {
      exitCode: err.status ?? 1,
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
    };
  }
}

/**
 * Parse NDJSON lines from a string and return matching entries.
 */
function parseNdjson(text: string): any[] {
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// ── Tests ──────────────────────────────────────────────────────────

describe('CLI stage control — --stage scan', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    createVueFixture(tmpDir);
  });

  afterEach(() => cleanup(tmpDir));

  it('exits with code 0 and produces no locale files', () => {
    const result = runCli(`migrate -p "${tmpDir}" --stage scan`, tmpDir);

    expect(result.exitCode).toBe(0);

    // No locale directory should be created
    const i18nDir = path.join(tmpDir, 'src', 'i18n');
    expect(fs.existsSync(i18nDir)).toBe(false);

    // Source file should remain unchanged
    const original = fs.readFileSync(path.join(tmpDir, 'src', 'App.vue'), 'utf-8');
    expect(original).toContain('你好世界');
  });

  it('emits NDJSON summary with filesScanned > 0', () => {
    const result = runCli(`migrate -p "${tmpDir}" --stage scan`, tmpDir);

    const entries = parseNdjson(result.stdout);
    const summary = entries.find(
      (e: any) => e.stage === 'summary' && e.event === 'done'
    );
    expect(summary).toBeDefined();
    expect(summary.filesScanned).toBeGreaterThan(0);
  });
});

describe('CLI stage control — --stage extract', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    createVueFixture(tmpDir);
  });

  afterEach(() => cleanup(tmpDir));

  it('exits with code 0 and produces no locale files', () => {
    const result = runCli(`migrate -p "${tmpDir}" --stage extract`, tmpDir);

    expect(result.exitCode).toBe(0);

    // No locale files should be created
    const localeFile = path.join(tmpDir, 'src', 'i18n', 'en.json');
    expect(fs.existsSync(localeFile)).toBe(false);

    // Source file unchanged
    const original = fs.readFileSync(path.join(tmpDir, 'src', 'App.vue'), 'utf-8');
    expect(original).toContain('你好世界');
  });
});

describe('CLI stage control — --stage translate', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    createVueFixture(tmpDir);
  });

  afterEach(() => cleanup(tmpDir));

  it('exits with code 0 and produces no source modification', () => {
    const original = fs.readFileSync(path.join(tmpDir, 'src', 'App.vue'), 'utf-8');
    const result = runCli(
      `migrate -p "${tmpDir}" --stage translate`,
      tmpDir
    );

    expect(result.exitCode).toBe(0);

    // Source file should remain unchanged (translate stage doesn't write)
    const current = fs.readFileSync(path.join(tmpDir, 'src', 'App.vue'), 'utf-8');
    expect(current).toBe(original);
  });
});

describe('CLI stage control — --from-json', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => cleanup(tmpDir));

  it('skips scan/extract and loads entries from JSON file', () => {
    // Create intermediate.json with keyed entries and translations
    const intermediate = {
      version: 1,
      entries: [
        {
          file: path.join(tmpDir, 'src', 'App.vue').replace(/\\/g, '/'),
          relPath: 'src/App.vue',
          originalKey: 'src/App.1',
          key: 'src/App.1',
          text: '你好世界',
          range: [19, 23],
          callSiteType: 'vue-template',
          framework: 'vue',
          isString: false,
        },
      ],
      translations: {
        en: {
          'src/App.1': '[en]你好世界',
        },
      },
    };

    // Config at project root (where loadConfig expects it)
    createFixture(tmpDir, {
      'i18n.json': JSON.stringify({
        include: ['**/*.{vue,tsx,jsx,ts,js,html}'],
        exclude: ['**/node_modules/**'],
        source: 'zh',
        to: ['en'],
      }),
      'src/App.vue': `<template>\n  <div>你好世界</div>\n</template>\n<script setup>\nconst msg = '欢迎使用'\n</script>`,
      '.sultana/intermediate.json': JSON.stringify(intermediate),
    });

    const jsonPath = path.join(tmpDir, '.sultana', 'intermediate.json');
    const result = runCli(
      `migrate -p "${tmpDir}" --from-json "${jsonPath}"`,
      tmpDir
    );

    expect(result.exitCode).toBe(0);

    // Locale file should be created from the intermediate entries
    const localeFile = path.join(tmpDir, 'src', 'i18n', 'en.json');
    expect(fs.existsSync(localeFile)).toBe(true);

    const translations = JSON.parse(fs.readFileSync(localeFile, 'utf-8'));
    // --from-json skips keying; keys remain as-is from intermediate JSON
    expect(translations['src/App.1']).toBeDefined();
    expect(translations['src/App.1']).toBe('[en]你好世界');
  });

  it('exits with code 1 when intermediate JSON does not exist', () => {
    createFixture(tmpDir, {
      'src/i18n.json': JSON.stringify({
        include: ['**/*.{vue,tsx,jsx,ts,js,html}'],
        exclude: ['**/node_modules/**'],
      }),
    });

    const result = runCli(
      `migrate -p "${tmpDir}" --from-json "${path.join(tmpDir, 'nonexistent.json')}"`,
      tmpDir
    );

    expect(result.exitCode).toBe(1);
  });
});

describe('CLI stage control — --dry-run', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    createVueFixture(tmpDir);
  });

  afterEach(() => cleanup(tmpDir));

  it('does not modify source files', () => {
    const sourceFile = path.join(tmpDir, 'src', 'App.vue');
    const originalContent = fs.readFileSync(sourceFile, 'utf-8');

    const result = runCli(
      `migrate -p "${tmpDir}" --dry-run`,
      tmpDir
    );

    expect(result.exitCode).toBe(0);

    // Source file must remain unchanged
    const currentContent = fs.readFileSync(sourceFile, 'utf-8');
    expect(currentContent).toBe(originalContent);
  });

  it('still produces locale output files (intermediate artifacts)', () => {
    const result = runCli(
      `migrate -p "${tmpDir}" --dry-run`,
      tmpDir
    );

    expect(result.exitCode).toBe(0);

    // Locale file should be created as an intermediate artifact
    const localeFile = path.join(tmpDir, 'src', 'i18n', 'en.json');
    expect(fs.existsSync(localeFile)).toBe(true);

    const translations = JSON.parse(fs.readFileSync(localeFile, 'utf-8'));
    expect(Object.keys(translations).length).toBeGreaterThan(0);
  });
});
