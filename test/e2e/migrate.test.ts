/**
 * E2E Tests — Full i18n migration pipeline
 *
 * Tests the complete flow: scan → extract → keying → translate → write
 * for Vue, React, and Angular frameworks.
 *
 * Uses child_process to spawn the CLI as a real process, verifying:
 * 1. Exit code is 0
 * 2. NDJSON output contains all pipeline stages
 * 3. Source files have no Chinese characters after migration
 * 4. Locale files (en.json) exist with expected keys
 * 5. Build step succeeds (Vue/React only)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ── Constants ─────────────────────────────────────────────────────

const CLI_PATH = path.resolve(__dirname, '..', '..', 'src', 'cli.ts');
const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures');
const CHINESE_REGEX = /[\u4e00-\u9fa5]/;

// ── Fixture paths ─────────────────────────────────────────────────

const FIXTURES = {
  vue: path.join(FIXTURES_DIR, 'vue'),
  react: path.join(FIXTURES_DIR, 'react'),
  angular: path.join(FIXTURES_DIR, 'angular'),
};

// ── Backup management ─────────────────────────────────────────────

interface BackupEntry {
  filePath: string;
  content: string;
}

const backups = new Map<string, BackupEntry[]>();

function backupFixture(fixtureName: string): void {
  const fixturePath = FIXTURES[fixtureName as keyof typeof FIXTURES];
  const entries: BackupEntry[] = [];

  // Find all source files in fixture
  const sourceFiles = findSourceFiles(fixturePath, fixtureName);

  for (const filePath of sourceFiles) {
    if (fs.existsSync(filePath)) {
      entries.push({
        filePath,
        content: fs.readFileSync(filePath, 'utf-8'),
      });
    }
  }

  backups.set(fixtureName, entries);
}

function restoreFixture(fixtureName: string): void {
  const entries = backups.get(fixtureName);
  if (!entries) return;

  for (const entry of entries) {
    const dir = path.dirname(entry.filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(entry.filePath, entry.content, 'utf-8');
  }

  // Clean up generated files
  cleanupGeneratedFiles(FIXTURES[fixtureName as keyof typeof FIXTURES]);
}

function findSourceFiles(dir: string, framework: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.sultana') {
          continue;
        }
        walk(fullPath);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (framework === 'vue' && ext === '.vue') {
          files.push(fullPath);
        } else if (framework === 'react' && (ext === '.tsx' || ext === '.jsx')) {
          files.push(fullPath);
        } else if (framework === 'angular' && (ext === '.ts' || ext === '.html')) {
          // Only component files
          if (entry.name.includes('component')) {
            files.push(fullPath);
          }
        }
      }
    }
  }

  walk(dir);
  return files;
}

function cleanupGeneratedFiles(fixturePath: string): void {
  // Remove i18n directory
  const i18nDir = path.join(fixturePath, 'src', 'i18n');
  if (fs.existsSync(i18nDir)) {
    fs.rmSync(i18nDir, { recursive: true, force: true });
  }

  // Remove .sultana directory
  const sultanaDir = path.join(fixturePath, '.sultana');
  if (fs.existsSync(sultanaDir)) {
    fs.rmSync(sultanaDir, { recursive: true, force: true });
  }
}

// ── CLI runner ────────────────────────────────────────────────────

function runCli(
  args: string,
  cwd: string,
  opts?: { checkExit?: boolean; env?: NodeJS.ProcessEnv; timeout?: number }
): { exitCode: number; stdout: string; stderr: string } {
  const cmd = `npx tsx "${CLI_PATH}" ${args}`;
  try {
    const stdout = execSync(cmd, {
      cwd,
      encoding: 'utf-8',
      timeout: opts?.timeout || 30000,
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

// ── Chinese character check ───────────────────────────────────────

function hasChineseCharacters(content: string): boolean {
  return CHINESE_REGEX.test(content);
}

function countChineseCharacters(content: string): number {
  const matches = content.match(new RegExp(CHINESE_REGEX, 'g'));
  return matches ? matches.length : 0;
}

// ── Test suites ───────────────────────────────────────────────────

describe('E2E Migration Pipeline', () => {
  describe('Vue Framework', () => {
    beforeAll(() => {
      backupFixture('vue');
    });

    afterAll(() => {
      restoreFixture('vue');
    });

    it('completes full migration with exit code 0', () => {
      const result = runCli(
        `migrate -p "${FIXTURES.vue}" --to en`,
        FIXTURES.vue,
        { timeout: 60000 }
      );

      expect(result.exitCode).toBe(0);
    });

    it('emits NDJSON with all pipeline stages', () => {
      const result = runCli(
        `migrate -p "${FIXTURES.vue}" --to en`,
        FIXTURES.vue,
        { timeout: 60000 }
      );

      const entries = parseNdjson(result.stdout);
      const stages = new Set(entries.map((e: any) => e.stage));

      expect(stages.has('scan')).toBe(true);
      expect(stages.has('extract')).toBe(true);
      expect(stages.has('keying')).toBe(true);
      expect(stages.has('translate')).toBe(true);
      expect(stages.has('summary')).toBe(true);
    });

    it('removes Chinese characters from source files', () => {
      const result = runCli(
        `migrate -p "${FIXTURES.vue}" --to en`,
        FIXTURES.vue,
        { timeout: 60000 }
      );

      // Check App.vue
      const appVuePath = path.join(FIXTURES.vue, 'App.vue');
      const appVueContent = fs.readFileSync(appVuePath, 'utf-8');
      expect(hasChineseCharacters(appVueContent)).toBe(false);
    });

    it('creates en.json with expected keys', () => {
      const result = runCli(
        `migrate -p "${FIXTURES.vue}" --to en`,
        FIXTURES.vue,
        { timeout: 60000 }
      );

      const enJsonPath = path.join(FIXTURES.vue, 'src', 'i18n', 'en.json');
      expect(fs.existsSync(enJsonPath)).toBe(true);

      const translations = JSON.parse(fs.readFileSync(enJsonPath, 'utf-8'));
      const keys = Object.keys(translations);

      // Should have keys for all Chinese text
      expect(keys.length).toBeGreaterThanOrEqual(5);

      // Keys must NOT be path-based (e.g. "src/App.1")
      for (const key of keys) {
        expect(key).not.toMatch(/\//);
        expect(key).toMatch(/^[a-zA-Z$][a-zA-Z0-9_$]*$/);
      }

      // Check that values are translated (stub format: [en]原文)
      for (const key of keys) {
        expect(translations[key]).toMatch(/^\[en\]/);
      }
    });

    it.skipIf(!process.env.SQUID_E2E_BUILD)(
      'vite build succeeds after migration',
      () => {
        const result = runCli(
          `migrate -p "${FIXTURES.vue}" --to en`,
          FIXTURES.vue,
          { timeout: 60000 }
        );

        // Run vite build
        const buildResult = runCli('npx vite build', FIXTURES.vue, {
          timeout: 60000,
        });

        expect(buildResult.exitCode).toBe(0);
      },
      60000
    );
  });

  describe('React Framework', () => {
    beforeAll(() => {
      backupFixture('react');
    });

    afterAll(() => {
      restoreFixture('react');
    });

    it('completes full migration with exit code 0', () => {
      const result = runCli(
        `migrate -p "${FIXTURES.react}" --to en`,
        FIXTURES.react,
        { timeout: 60000 }
      );

      expect(result.exitCode).toBe(0);
    });

    it('emits NDJSON with all pipeline stages', () => {
      const result = runCli(
        `migrate -p "${FIXTURES.react}" --to en`,
        FIXTURES.react,
        { timeout: 60000 }
      );

      const entries = parseNdjson(result.stdout);
      const stages = new Set(entries.map((e: any) => e.stage));

      expect(stages.has('scan')).toBe(true);
      expect(stages.has('extract')).toBe(true);
      expect(stages.has('keying')).toBe(true);
      expect(stages.has('translate')).toBe(true);
      expect(stages.has('summary')).toBe(true);
    });

    it('removes Chinese characters from source files', () => {
      const result = runCli(
        `migrate -p "${FIXTURES.react}" --to en`,
        FIXTURES.react,
        { timeout: 60000 }
      );

      // Check App.tsx
      const appTsxPath = path.join(FIXTURES.react, 'App.tsx');
      const appTsxContent = fs.readFileSync(appTsxPath, 'utf-8');
      expect(hasChineseCharacters(appTsxContent)).toBe(false);
    });

    it('creates en.json with expected keys', () => {
      const result = runCli(
        `migrate -p "${FIXTURES.react}" --to en`,
        FIXTURES.react,
        { timeout: 60000 }
      );

      const enJsonPath = path.join(FIXTURES.react, 'src', 'i18n', 'en.json');
      expect(fs.existsSync(enJsonPath)).toBe(true);

      const translations = JSON.parse(fs.readFileSync(enJsonPath, 'utf-8'));
      const keys = Object.keys(translations);

      // Should have keys for all Chinese text
      expect(keys.length).toBeGreaterThanOrEqual(5);

      // Keys must NOT be path-based (e.g. "src/App.1")
      for (const key of keys) {
        expect(key).not.toMatch(/\//);
        expect(key).toMatch(/^[a-zA-Z$][a-zA-Z0-9_$]*$/);
      }

      // Check that values are translated (stub format: [en]原文)
      for (const key of keys) {
        expect(translations[key]).toMatch(/^\[en\]/);
      }
    });

    it.skipIf(!process.env.SQUID_E2E_BUILD)(
      'vite build succeeds after migration',
      () => {
        const result = runCli(
          `migrate -p "${FIXTURES.react}" --to en`,
          FIXTURES.react,
          { timeout: 60000 }
        );

        // Run vite build
        const buildResult = runCli('npx vite build', FIXTURES.react, {
          timeout: 60000,
        });

        expect(buildResult.exitCode).toBe(0);
      },
      60000
    );
  });

  describe('Angular Framework', () => {
    beforeAll(() => {
      backupFixture('angular');
    });

    afterAll(() => {
      restoreFixture('angular');
    });

    it('completes full migration with exit code 0', () => {
      const result = runCli(
        `migrate -p "${FIXTURES.angular}" --to en`,
        FIXTURES.angular,
        { timeout: 60000 }
      );

      expect(result.exitCode).toBe(0);
    });

    it('emits NDJSON with all pipeline stages', () => {
      const result = runCli(
        `migrate -p "${FIXTURES.angular}" --to en`,
        FIXTURES.angular,
        { timeout: 60000 }
      );

      const entries = parseNdjson(result.stdout);
      const stages = new Set(entries.map((e: any) => e.stage));

      expect(stages.has('scan')).toBe(true);
      expect(stages.has('extract')).toBe(true);
      expect(stages.has('keying')).toBe(true);
      expect(stages.has('translate')).toBe(true);
      expect(stages.has('summary')).toBe(true);
    });

    it('removes Chinese characters from template files', () => {
      const result = runCli(
        `migrate -p "${FIXTURES.angular}" --to en`,
        FIXTURES.angular,
        { timeout: 60000 }
      );

      // Check app.component.html
      const templatePath = path.join(FIXTURES.angular, 'src', 'app', 'app.component.html');
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      expect(hasChineseCharacters(templateContent)).toBe(false);
    });

    it('removes Chinese characters from component files', () => {
      const result = runCli(
        `migrate -p "${FIXTURES.angular}" --to en`,
        FIXTURES.angular,
        { timeout: 60000 }
      );

      // Check app.component.ts
      const componentPath = path.join(FIXTURES.angular, 'src', 'app', 'app.component.ts');
      const componentContent = fs.readFileSync(componentPath, 'utf-8');
      expect(hasChineseCharacters(componentContent)).toBe(false);
    });

    it('creates en.json with expected keys', () => {
      const result = runCli(
        `migrate -p "${FIXTURES.angular}" --to en`,
        FIXTURES.angular,
        { timeout: 60000 }
      );

      const enJsonPath = path.join(FIXTURES.angular, 'src', 'i18n', 'en.json');
      expect(fs.existsSync(enJsonPath)).toBe(true);

      const translations = JSON.parse(fs.readFileSync(enJsonPath, 'utf-8'));
      const keys = Object.keys(translations);

      // Should have keys for all Chinese text
      expect(keys.length).toBeGreaterThanOrEqual(5);

      // Keys must NOT be path-based (e.g. "src/App.1")
      for (const key of keys) {
        expect(key).not.toMatch(/\//);
        expect(key).toMatch(/^[a-zA-Z$][a-zA-Z0-9_$]*$/);
      }

      // Check that values are translated (stub format: [en]原文)
      for (const key of keys) {
        expect(translations[key]).toMatch(/^\[en\]/);
      }
    });

    // Note: Angular build requires full CLI setup (ng), skipping for now
    it.skip('ng build succeeds after migration (skipped - requires full Angular CLI setup)', () => {
      // This test would require `ng` to be installed globally or via npx
      const result = runCli(
        `migrate -p "${FIXTURES.angular}" --to en`,
        FIXTURES.angular,
        { timeout: 60000 }
      );

      const buildResult = runCli('npx ng build', FIXTURES.angular, {
        timeout: 60000,
      });

      expect(buildResult.exitCode).toBe(0);
    });
  });
});