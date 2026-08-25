#!/usr/bin/env node

/**
 * sultana-inter CLI — Multi-framework AI i18n Migration Tool
 *
 * Pipeline: scan → extract → keying → annotate → translate → write
 *
 * Usage:
 *   su-inter migrate -p <project-path> [options]
 *   su-inter migrate --from-json <path> [options]
 */

import * as path from 'path';
import * as fs from 'fs';
import { Command } from 'commander';
import { I18nConfig } from './types';
import { logger } from './logger';
import { scan } from './scanner';
import { extract } from './extractor';
import { key } from './keyer';
import { annotate } from './annotator';
import { translate, StubTranslator, TranslationMap } from './translator';
import { write } from './writer';

const VERSION = '2.0.0';

function loadConfig(rootPath: string, configPath?: string): I18nConfig {
  const resolvedPath = configPath
    ? path.resolve(configPath)
    : path.join(rootPath, 'i18n.json');

  if (!fs.existsSync(resolvedPath)) {
    logger.log('warn', 'config', `No i18n.json found at ${resolvedPath}, using defaults`);
    return { include: ['**/*.{vue,tsx,jsx,ts,js,html}'], exclude: ['**/node_modules/**'] };
  }

  try {
    const raw = fs.readFileSync(resolvedPath, 'utf-8');
    const conf: I18nConfig = JSON.parse(raw);
    // Ensure required fields
    if (!conf.include) conf.include = ['**/*.{vue,tsx,jsx,ts,js,html}'];
    if (!conf.exclude) conf.exclude = ['**/node_modules/**'];
    return conf;
  } catch (err) {
    logger.log('error', 'config', `Failed to parse i18n.json: ${err}`);
    process.exit(1);
  }
}

function mergeCliOptions(
  conf: I18nConfig,
  opts: {
    source?: string;
    to?: string[];
    framework?: string;
    dryRun?: boolean;
    stage?: string;
    fromJson?: string;
    logFile?: string;
  }
): I18nConfig & { dryRun: boolean; stage?: string; fromJson?: string } {
  const merged = { ...conf };

  if (opts.source) merged.source = opts.source;
  if (opts.to && opts.to.length > 0) merged.to = opts.to;
  if (opts.framework) merged.framework = opts.framework as any;

  return {
    ...merged,
    dryRun: opts.dryRun || false,
    stage: opts.stage,
    fromJson: opts.fromJson,
  };
}

async function main() {
  const program = new Command();
  program
    .name('su-inter')
    .description('Multi-framework AI i18n migration tool')
    .version(VERSION);

  program
    .command('migrate')
    .description('Run the i18n migration pipeline')
    .requiredOption('-p, --path <path>', 'Project root path')
    .option('-s, --source <lang>', 'Source language code', 'zh')
    .option('-t, --to <lang>', 'Target language code(s)', collectArray, [])
    .option('-f, --framework <fw>', 'Force framework (vue/react/angular)')
    .option('-c, --config <path>', 'Path to i18n.json config')
    .option('--dry-run', 'Produce intermediate files only, no source modification')
    .option('--stage <stage>', 'Run only a specific stage (scan/extract/keying/annotate/translate/write)')
    .option('--from-json <path>', 'Resume from keying stage with existing intermediate JSON')
    .option('--log-file <path>', 'Mirror NDJSON output to file')
    .action(async (opts) => {
      const rootPath = path.resolve(opts.path);

      if (!fs.existsSync(rootPath)) {
        logger.log('error', 'cli', `Path does not exist: ${rootPath}`);
        process.exit(1);
      }

      // Open log file if specified
      if (opts.logFile) {
        logger.open(path.resolve(opts.logFile));
      }

      const conf = loadConfig(rootPath, opts.config);
      const merged = mergeCliOptions(conf, opts);

      try {
        await runPipeline(rootPath, merged);
      } catch (err) {
        logger.log('error', 'pipeline', `Pipeline failed: ${err}`);
        process.exit(1);
      } finally {
        logger.close();
      }
    });

  program.parse(process.argv);
}

function collectArray(value: string, prev: string[]): string[] {
  return prev.concat([value]);
}

async function runPipeline(
  rootPath: string,
  conf: I18nConfig & { dryRun: boolean; stage?: string; fromJson?: string }
) {
  const startTime = Date.now();

  // Default source and target
  conf.source = conf.source || 'zh';
  conf.to = conf.to || ['en'];

  logger.progress(`Starting migration: ${rootPath}`);
  logger.progress(`Source: ${conf.source} → Targets: ${conf.to.join(', ')}`);

  let scannedFiles: any[] = [];
  let entries: any[] = [];
  let keyedEntries: any[] = [];
  let translationMap: TranslationMap = {};
  let rewritten = new Map<string, string>();
  let modifiedFiles: string[] = [];

  // ── Resume from intermediate JSON ────────────────────────────
  if (conf.fromJson) {
    const jsonPath = path.resolve(conf.fromJson);
    if (!fs.existsSync(jsonPath)) {
      logger.log('error', 'pipeline', `Intermediate JSON not found: ${jsonPath}`);
      process.exit(1);
    }
    const intermediate = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    keyedEntries = intermediate.entries || [];
    if (intermediate.translations) {
      translationMap = intermediate.translations;
    }
    logger.progress(`Resumed from ${keyedEntries.length} entries in ${jsonPath}`);
  }

  // ── Stage: Scan ──────────────────────────────────────────────
  if (!conf.fromJson && (!conf.stage || conf.stage === 'scan')) {
    scannedFiles = scan(rootPath, conf);
    if (conf.stage === 'scan') {
      printSummary(scannedFiles.length, 0, 0, 0, 0, Date.now() - startTime);
      return;
    }
  }

  // ── Stage: Extract ───────────────────────────────────────────
  if (!conf.fromJson && (!conf.stage || conf.stage === 'extract')) {
    entries = extract(scannedFiles, rootPath, conf);
    if (conf.stage === 'extract') {
      printSummary(scannedFiles.length, entries.length, 0, 0, 0, Date.now() - startTime);
      return;
    }
  }

  // ── Stage: Translate ─────────────────────────────────────────
  if (!conf.fromJson && (!conf.stage || conf.stage === 'translate')) {
    translationMap = await translate(entries, conf);
    if (conf.stage === 'translate') {
      printSummary(scannedFiles.length, entries.length, 0, 1, 0, Date.now() - startTime);
      return;
    }
  }

  // ── Stage: Keying ────────────────────────────────────────────
  if (!conf.stage || conf.stage === 'keying') {
    if (conf.fromJson) {
      // Already loaded from JSON
    } else {
      keyedEntries = await key(entries, conf, translationMap, rootPath);
    }
    if (conf.stage === 'keying') {
      // Save intermediate JSON for potential resume
      const intermediatePath = path.join(rootPath, '.sultana', 'intermediate.json');
      ensureDir(intermediatePath);
      fs.writeFileSync(
        intermediatePath,
        JSON.stringify({ version: 1, entries: keyedEntries, translations: translationMap }, null, 2)
      );
      logger.progress(`Saved intermediate JSON to ${intermediatePath}`);
      printSummary(0, 0, keyedEntries.length, 0, 0, Date.now() - startTime);
      return;
    }
  }

  // ── Stage: Annotate ──────────────────────────────────────────
  if (!conf.stage || conf.stage === 'annotate') {
    const annotateResult = annotate(keyedEntries, conf);
    rewritten = annotateResult.rewritten;
    modifiedFiles = annotateResult.modifiedFiles;
    if (conf.stage === 'annotate') {
      printSummary(0, 0, keyedEntries.length, 0, 0, Date.now() - startTime);
      return;
    }
  }

  // ── Stage: Write ─────────────────────────────────────────────
  if (!conf.stage || conf.stage === 'write') {
    write(rootPath, conf, keyedEntries, translationMap, rewritten, conf.dryRun);
  }

  // ── Summary ──────────────────────────────────────────────────
  const totalMs = Date.now() - startTime;
  printSummary(
    scannedFiles.length,
    entries.length || keyedEntries.length,
    keyedEntries.length,
    conf.to?.length || 0,
    modifiedFiles.length,
    totalMs
  );
}

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function printSummary(
  filesScanned: number,
  entriesExtracted: number,
  keysGenerated: number,
  languages: number,
  filesModified: number,
  totalMs: number
): void {
  logger.ndjson({
    stage: 'summary',
    event: 'done',
    filesScanned,
    entriesExtracted,
    keysGenerated,
    languages,
    filesModified,
    totalMs,
  });

  logger.progress('\n── Migration Summary ──');
  logger.progress(`  Files scanned:   ${filesScanned}`);
  logger.progress(`  Entries found:   ${entriesExtracted}`);
  logger.progress(`  Keys generated:  ${keysGenerated}`);
  logger.progress(`  Languages:       ${languages}`);
  logger.progress(`  Files modified:  ${filesModified}`);
  logger.progress(`  Total time:      ${totalMs}ms`);
  logger.progress('─────────────────────');
}

main();
