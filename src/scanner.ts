/**
 * Pipeline stage 1: Scanner
 *
 * Walks the project tree, applies include/exclude globs,
 * classifies files by framework, emits NDJSON log.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as micromatch from 'micromatch';
import { I18nConfig, Framework, ScannedFile } from './types';
import { logger } from './logger';

const FRAMEWORK_EXT_MAP: Record<string, Framework> = {
  '.vue': 'vue',
  '.tsx': 'react',
  '.jsx': 'react',
  '.html': 'angular',
};

/**
 * Detect framework from file extension.
 * Returns undefined for ambiguous extensions (.ts, .js).
 */
function frameworkFromExt(ext: string): Framework | undefined {
  return FRAMEWORK_EXT_MAP[ext];
}

/**
 * Detect framework for Angular by checking if the HTML file
 * is referenced by an Angular component (heuristic: presence of
 * component decorator or .component. in filename).
 */
function isAngularHtml(filePath: string): boolean {
  const basename = path.basename(filePath).toLowerCase();
  return basename.includes('.component.');
}

/**
 * Recursively walk directory and collect matching files.
 */
function walkDir(dir: string, rootPath: string, conf: I18nConfig): ScannedFile[] {
  const results: ScannedFile[] = [];

  function walk(currentDir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absPath = path.join(currentDir, entry.name);
      const relPath = absPath.replace(rootPath, '').replace(/\\/g, '/').replace(/^\//, '');

      if (entry.isDirectory()) {
        walk(absPath);
        continue;
      }

      if (!entry.isFile()) continue;

      // Apply include/exclude globs
      if (!micromatch.isMatch(relPath, conf.include)) continue;
      if (micromatch.isMatch(relPath, conf.exclude)) continue;

      const ext = path.extname(entry.name).toLowerCase();

      // Only process known extensions
      if (!['.vue', '.tsx', '.jsx', '.ts', '.js', '.html'].includes(ext)) continue;

      let framework = frameworkFromExt(ext);

      // Ambiguous extensions: use project default
      if (!framework) {
        if (conf.framework) {
          framework = conf.framework;
        } else {
          // Skip ambiguous files with warning
          logger.log('warn', 'scan', `Skipping ambiguous file (no framework): ${relPath}`);
          continue;
        }
      }

      // Special handling for Angular HTML
      if (ext === '.html' && framework === 'angular' && !isAngularHtml(absPath)) {
        // Could be a generic HTML file, still treat as angular per config
      }

      results.push({
        absPath,
        relPath,
        framework,
        ext,
      });
    }
  }

  walk(dir);
  return results;
}

/**
 * Stage 1: Scan project and return classified files.
 */
export function scan(rootPath: string, conf: I18nConfig): ScannedFile[] {
  const startTime = Date.now();
  const files = walkDir(rootPath, rootPath, conf);
  const ms = Date.now() - startTime;

  // Group by framework for logging
  const byFramework: Record<string, number> = {};
  for (const f of files) {
    byFramework[f.framework] = (byFramework[f.framework] || 0) + 1;
  }

  logger.ndjson({
    stage: 'scan',
    event: 'done',
    total: files.length,
    byFramework,
    ms,
  });

  logger.progress(
    `Scanned ${files.length} files (${Object.entries(byFramework)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ')}) in ${ms}ms`
  );

  return files;
}
