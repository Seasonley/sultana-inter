import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../src/logger';

describe('logger', () => {
  let stdoutWrite: ReturnType<typeof vi.spyOn>;
  let stderrWrite: ReturnType<typeof vi.spyOn>;
  let stdoutOutput: string;
  let stderrOutput: string;

  beforeEach(() => {
    stdoutOutput = '';
    stderrOutput = '';
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation((data: any) => {
      stdoutOutput += data.toString();
      return true;
    });
    stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation((data: any) => {
      stderrOutput += data.toString();
      return true;
    });
  });

  afterEach(() => {
    stdoutWrite.mockRestore();
    stderrWrite.mockRestore();
  });

  it('ndjson writes valid JSON to stdout', () => {
    logger.ndjson({ stage: 'test', event: 'done', count: 42 });
    const line = stdoutOutput.trim();
    const parsed = JSON.parse(line);
    expect(parsed.stage).toBe('test');
    expect(parsed.event).toBe('done');
    expect(parsed.count).toBe(42);
    expect(parsed.ts).toBeDefined();
  });

  it('progress writes human-readable text to stderr', () => {
    logger.progress('Hello world');
    expect(stderrOutput).toContain('Hello world');
  });

  it('log writes to both stdout (ndjson) and stderr', () => {
    logger.log('info', 'scan', 'Found 10 files');
    expect(stderrOutput).toContain('[scan]');
    expect(stderrOutput).toContain('Found 10 files');
    const ndjsonLine = stdoutOutput.trim();
    const parsed = JSON.parse(ndjsonLine);
    expect(parsed.stage).toBe('scan');
    expect(parsed.event).toBe('info');
  });
});
