/**
 * Pipeline stage 2: Extractor
 *
 * Dispatches to framework-specific extractors and aggregates results.
 */

import * as fs from 'fs';
import { I18nConfig, ScannedFile, ExtractedEntry } from './types';
import { extractReact } from './extractors/react';
import { extractAngular } from './extractors/angular';
import { extractVue } from './extractors/vue';
import { logger } from './logger';

/**
 * Stage 2: Extract hardcoded Chinese text from all scanned files.
 */
export function extract(
  files: ScannedFile[],
  rootPath: string,
  _conf: I18nConfig
): ExtractedEntry[] {
  const startTime = Date.now();
  const allEntries: ExtractedEntry[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file.absPath, 'utf-8');
    let entries: ExtractedEntry[] = [];

    switch (file.framework) {
      case 'react':
        entries = extractReact(file.absPath, file.relPath, content);
        break;
      case 'angular':
        entries = extractAngular(file.absPath, file.relPath, content);
        break;
      case 'vue':
        entries = extractVue(file.absPath, file.relPath, content);
        break;
    }

    if (entries.length > 0) {
      logger.ndjson({
        stage: 'extract',
        event: 'file',
        file: file.relPath,
        framework: file.framework,
        count: entries.length,
      });
    }

    allEntries.push(...entries);
  }

  const ms = Date.now() - startTime;
  logger.ndjson({
    stage: 'extract',
    event: 'done',
    files: files.length,
    entries: allEntries.length,
    ms,
  });

  logger.progress(
    `Extracted ${allEntries.length} Chinese entries from ${files.length} files in ${ms}ms`
  );

  return allEntries;
}
