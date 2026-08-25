import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { scan } from '../src/scanner';
import { logger } from '../src/logger';

// Mock logger to suppress output during tests
vi.mock('../src/logger', () => ({
  logger: {
    ndjson: vi.fn(),
    progress: vi.fn(),
    log: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
  },
}));

describe('scanner', () => {
  const fixtureDir = path.join(__dirname, 'fixtures', 'scanner');

  beforeEach(() => {
    // Create test fixture directory
    fs.mkdirSync(path.join(fixtureDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(fixtureDir, 'node_modules'), { recursive: true });

    // Create test files
    fs.writeFileSync(path.join(fixtureDir, 'src', 'App.tsx'), '<div>test</div>');
    fs.writeFileSync(path.join(fixtureDir, 'src', 'Home.vue'), '<template><div>test</div></template>');
    fs.writeFileSync(path.join(fixtureDir, 'src', 'app.component.html'), '<div>test</div>');
    fs.writeFileSync(path.join(fixtureDir, 'src', 'utils.ts'), 'export const x = 1;');
    fs.writeFileSync(path.join(fixtureDir, 'src', 'data.json'), '{}');
    fs.writeFileSync(path.join(fixtureDir, 'node_modules', 'dep.ts'), 'export const x = 1;');
  });

  afterEach(() => {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('scans files matching include patterns', () => {
    const conf = {
      include: ['**/*.{vue,tsx,jsx,ts,js,html}'],
      exclude: ['**/node_modules/**'],
    };
    const files = scan(fixtureDir, conf);
    const relPaths = files.map(f => f.relPath);
    expect(relPaths).toContain('src/App.tsx');
    expect(relPaths).toContain('src/Home.vue');
    expect(relPaths).toContain('src/app.component.html');
  });

  it('excludes node_modules', () => {
    const conf = {
      include: ['**/*.{vue,tsx,jsx,ts,js,html}'],
      exclude: ['**/node_modules/**'],
    };
    const files = scan(fixtureDir, conf);
    const hasNodeModules = files.some(f => f.relPath.includes('node_modules'));
    expect(hasNodeModules).toBe(false);
  });

  it('classifies frameworks by extension', () => {
    const conf = {
      include: ['**/*.{vue,tsx,jsx,ts,js,html}'],
      exclude: ['**/node_modules/**'],
    };
    const files = scan(fixtureDir, conf);
    const vueFile = files.find(f => f.relPath.includes('Home.vue'));
    const reactFile = files.find(f => f.relPath.includes('App.tsx'));
    const angularFile = files.find(f => f.relPath.includes('app.component.html'));
    expect(vueFile?.framework).toBe('vue');
    expect(reactFile?.framework).toBe('react');
    expect(angularFile?.framework).toBe('angular');
  });

  it('uses project default framework for ambiguous files', () => {
    const conf = {
      include: ['**/*.{vue,tsx,jsx,ts,js,html}'],
      exclude: ['**/node_modules/**'],
      framework: 'react' as const,
    };
    const files = scan(fixtureDir, conf);
    const tsFile = files.find(f => f.relPath.includes('utils.ts'));
    expect(tsFile?.framework).toBe('react');
  });

  it('skips ambiguous files when no default framework', () => {
    const conf = {
      include: ['**/*.{vue,tsx,jsx,ts,js,html}'],
      exclude: ['**/node_modules/**'],
    };
    const files = scan(fixtureDir, conf);
    const tsFile = files.find(f => f.relPath.includes('utils.ts'));
    // .ts files without framework should be skipped
    expect(tsFile).toBeUndefined();
  });

  it('emits NDJSON log with scan stats', () => {
    const conf = {
      include: ['**/*.{vue,tsx,jsx,ts,js,html}'],
      exclude: ['**/node_modules/**'],
    };
    scan(fixtureDir, conf);
    const ndjsonCalls = (logger.ndjson as any).mock.calls;
    const doneLog = ndjsonCalls.find((call: any[]) => call[0].event === 'done');
    expect(doneLog).toBeDefined();
    expect(doneLog[0].stage).toBe('scan');
    expect(doneLog[0].total).toBeGreaterThan(0);
  });
});
