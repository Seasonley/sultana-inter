#!/usr/bin/env node
"use strict";
/**
 * sultana-inter CLI — Multi-framework AI i18n Migration Tool
 *
 * Pipeline: scan → extract → keying → annotate → translate → write
 *
 * Usage:
 *   su-inter migrate -p <project-path> [options]
 *   su-inter migrate --from-json <path> [options]
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const commander_1 = require("commander");
const logger_1 = require("./logger");
const scanner_1 = require("./scanner");
const extractor_1 = require("./extractor");
const keyer_1 = require("./keyer");
const annotator_1 = require("./annotator");
const translator_1 = require("./translator");
const writer_1 = require("./writer");
const VERSION = '2.0.0';
function loadConfig(rootPath, configPath) {
    const resolvedPath = configPath
        ? path.resolve(configPath)
        : path.join(rootPath, 'i18n.json');
    if (!fs.existsSync(resolvedPath)) {
        logger_1.logger.log('warn', 'config', `No i18n.json found at ${resolvedPath}, using defaults`);
        return { include: ['**/*.{vue,tsx,jsx,ts,js,html}'], exclude: ['**/node_modules/**'] };
    }
    try {
        const raw = fs.readFileSync(resolvedPath, 'utf-8');
        const conf = JSON.parse(raw);
        // Ensure required fields
        if (!conf.include)
            conf.include = ['**/*.{vue,tsx,jsx,ts,js,html}'];
        if (!conf.exclude)
            conf.exclude = ['**/node_modules/**'];
        return conf;
    }
    catch (err) {
        logger_1.logger.log('error', 'config', `Failed to parse i18n.json: ${err}`);
        process.exit(1);
    }
}
function mergeCliOptions(conf, opts) {
    const merged = { ...conf };
    if (opts.source)
        merged.source = opts.source;
    if (opts.to && opts.to.length > 0)
        merged.to = opts.to;
    if (opts.framework)
        merged.framework = opts.framework;
    return {
        ...merged,
        dryRun: opts.dryRun || false,
        stage: opts.stage,
        fromJson: opts.fromJson,
    };
}
async function main() {
    const program = new commander_1.Command();
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
            logger_1.logger.log('error', 'cli', `Path does not exist: ${rootPath}`);
            process.exit(1);
        }
        // Open log file if specified
        if (opts.logFile) {
            logger_1.logger.open(path.resolve(opts.logFile));
        }
        const conf = loadConfig(rootPath, opts.config);
        const merged = mergeCliOptions(conf, opts);
        try {
            await runPipeline(rootPath, merged);
        }
        catch (err) {
            logger_1.logger.log('error', 'pipeline', `Pipeline failed: ${err}`);
            process.exit(1);
        }
        finally {
            logger_1.logger.close();
        }
    });
    program.parse(process.argv);
}
function collectArray(value, prev) {
    return prev.concat([value]);
}
async function runPipeline(rootPath, conf) {
    const startTime = Date.now();
    // Default source and target
    conf.source = conf.source || 'zh';
    conf.to = conf.to || ['en'];
    logger_1.logger.progress(`Starting migration: ${rootPath}`);
    logger_1.logger.progress(`Source: ${conf.source} → Targets: ${conf.to.join(', ')}`);
    let scannedFiles = [];
    let entries = [];
    let keyedEntries = [];
    let translationMap = {};
    let rewritten = new Map();
    let modifiedFiles = [];
    // ── Resume from intermediate JSON ────────────────────────────
    if (conf.fromJson) {
        const jsonPath = path.resolve(conf.fromJson);
        if (!fs.existsSync(jsonPath)) {
            logger_1.logger.log('error', 'pipeline', `Intermediate JSON not found: ${jsonPath}`);
            process.exit(1);
        }
        const intermediate = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        keyedEntries = intermediate.entries || [];
        if (intermediate.translations) {
            translationMap = intermediate.translations;
        }
        logger_1.logger.progress(`Resumed from ${keyedEntries.length} entries in ${jsonPath}`);
    }
    // ── Stage: Scan ──────────────────────────────────────────────
    if (!conf.fromJson && (!conf.stage || conf.stage === 'scan')) {
        scannedFiles = (0, scanner_1.scan)(rootPath, conf);
        if (conf.stage === 'scan') {
            printSummary(scannedFiles.length, 0, 0, 0, 0, Date.now() - startTime);
            return;
        }
    }
    // ── Stage: Extract ───────────────────────────────────────────
    if (!conf.fromJson && (!conf.stage || conf.stage === 'extract')) {
        entries = (0, extractor_1.extract)(scannedFiles, rootPath, conf);
        if (conf.stage === 'extract') {
            printSummary(scannedFiles.length, entries.length, 0, 0, 0, Date.now() - startTime);
            return;
        }
    }
    // ── Stage: Translate ─────────────────────────────────────────
    if (!conf.fromJson && (!conf.stage || conf.stage === 'translate')) {
        translationMap = await (0, translator_1.translate)(entries, conf);
        if (conf.stage === 'translate') {
            printSummary(scannedFiles.length, entries.length, 0, 1, 0, Date.now() - startTime);
            return;
        }
    }
    // ── Stage: Keying ────────────────────────────────────────────
    if (!conf.stage || conf.stage === 'keying') {
        if (conf.fromJson) {
            // Already loaded from JSON
        }
        else {
            keyedEntries = await (0, keyer_1.key)(entries, conf, translationMap, rootPath);
        }
        if (conf.stage === 'keying') {
            // Save intermediate JSON for potential resume
            const intermediatePath = path.join(rootPath, '.sultana', 'intermediate.json');
            ensureDir(intermediatePath);
            fs.writeFileSync(intermediatePath, JSON.stringify({ version: 1, entries: keyedEntries, translations: translationMap }, null, 2));
            logger_1.logger.progress(`Saved intermediate JSON to ${intermediatePath}`);
            printSummary(0, 0, keyedEntries.length, 0, 0, Date.now() - startTime);
            return;
        }
    }
    // ── Stage: Annotate ──────────────────────────────────────────
    if (!conf.stage || conf.stage === 'annotate') {
        const annotateResult = (0, annotator_1.annotate)(keyedEntries, conf);
        rewritten = annotateResult.rewritten;
        modifiedFiles = annotateResult.modifiedFiles;
        if (conf.stage === 'annotate') {
            printSummary(0, 0, keyedEntries.length, 0, 0, Date.now() - startTime);
            return;
        }
    }
    // ── Stage: Write ─────────────────────────────────────────────
    if (!conf.stage || conf.stage === 'write') {
        (0, writer_1.write)(rootPath, conf, keyedEntries, translationMap, rewritten, conf.dryRun);
    }
    // ── Summary ──────────────────────────────────────────────────
    const totalMs = Date.now() - startTime;
    printSummary(scannedFiles.length, entries.length || keyedEntries.length, keyedEntries.length, conf.to?.length || 0, modifiedFiles.length, totalMs);
}
function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
function printSummary(filesScanned, entriesExtracted, keysGenerated, languages, filesModified, totalMs) {
    logger_1.logger.ndjson({
        stage: 'summary',
        event: 'done',
        filesScanned,
        entriesExtracted,
        keysGenerated,
        languages,
        filesModified,
        totalMs,
    });
    logger_1.logger.progress('\n── Migration Summary ──');
    logger_1.logger.progress(`  Files scanned:   ${filesScanned}`);
    logger_1.logger.progress(`  Entries found:   ${entriesExtracted}`);
    logger_1.logger.progress(`  Keys generated:  ${keysGenerated}`);
    logger_1.logger.progress(`  Languages:       ${languages}`);
    logger_1.logger.progress(`  Files modified:  ${filesModified}`);
    logger_1.logger.progress(`  Total time:      ${totalMs}ms`);
    logger_1.logger.progress('─────────────────────');
}
main();
//# sourceMappingURL=cli.js.map