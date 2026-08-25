/**
 * Pipeline stage 6: Writer
 *
 * Writes locale JSON files, generates framework-specific runtime init files,
 * and performs incremental merge on existing locale files.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  I18nConfig,
  KeyedEntry,
  Framework,
  WrittenFile,
} from './types';
import { TranslationMap } from './translator';
import { logger } from './logger';

// ── Locale file writer ───────────────────────────────────────────

function getLocalePath(
  rootPath: string,
  conf: I18nConfig,
  lang: string
): string {
  const template = conf.localePath || 'src/i18n/{{lang}}.json';
  return path.join(rootPath, template.replace('{{lang}}', lang));
}

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readExistingJson(filePath: string): Record<string, string> {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // Ignore parse errors, start fresh
  }
  return {};
}

/**
 * Write locale JSON files with incremental merge.
 */
function writeLocaleFiles(
  rootPath: string,
  conf: I18nConfig,
  translationMap: TranslationMap
): WrittenFile[] {
  const written: WrittenFile[] = [];
  const targets = conf.to || ['en'];

  for (const lang of targets) {
    const filePath = getLocalePath(rootPath, conf, lang);
    ensureDir(filePath);

    // Read existing for incremental merge
    const existing = readExistingJson(filePath);
    const translations = translationMap[lang] || {};

    // Merge: new translations override existing
    const merged = { ...existing, ...translations };

    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n');

    written.push({
      absPath: filePath,
      type: 'locale',
      lang,
    });

    logger.ndjson({
      stage: 'write',
      event: 'locale',
      lang,
      keys: Object.keys(merged).length,
      newKeys: Object.keys(translations).length,
      path: path.relative(rootPath, filePath),
    });
  }

  return written;
}

// ── Runtime init file generator ──────────────────────────────────

function generateVueInit(rootPath: string, conf: I18nConfig): string {
  const targets = conf.to || ['en'];
  const source = conf.source || 'zh';
  const allLangs = [source, ...targets];

  const imports = allLangs
    .map((lang) => `import ${lang} from './${lang}.json';`)
    .join('\n');

  return `${imports}
import { createI18n } from 'vue-i18n';

const i18n = createI18n({
  legacy: false,
  locale: '${source}',
  fallbackLocale: '${targets[0] || 'en'}',
  messages: {
    ${allLangs.map((lang) => `${lang},`).join('\n    ')}
  }
});

export default i18n;
`;
}

function generateReactInit(rootPath: string, conf: I18nConfig): string {
  const targets = conf.to || ['en'];
  const source = conf.source || 'zh';

  return `import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
${[source, ...targets]
  .map((lang) => `import ${lang} from './${lang}.json';`)
  .join('\n')}

i18n.use(initReactI18next).init({
  resources: {
    ${[source, ...targets]
      .map((lang) => `${lang}: { translation: ${lang} }`)
      .join(',\n    ')}
  },
  lng: '${source}',
  fallbackLng: '${targets[0] || 'en'}',
  interpolation: { escapeValue: false }
});

export default i18n;
`;
}

function generateAngularInit(rootPath: string, conf: I18nConfig): string {
  const targets = conf.to || ['en'];
  const source = conf.source || 'zh';

  return `import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './i18n/', '.json');
}

export const translateModuleConfig = {
  loader: {
    provide: TranslateLoader,
    useFactory: HttpLoaderFactory,
    deps: [HttpClient]
  }
};
`;
}

function writeInitFile(
  rootPath: string,
  conf: I18nConfig
): WrittenFile | null {
  const framework = conf.framework;
  if (!framework) return null;

  const initPath = conf.initPath || `src/i18n/index.${framework === 'react' ? 'tsx' : 'ts'}`;
  const fullPath = path.join(rootPath, initPath);
  ensureDir(fullPath);

  let content: string;
  switch (framework) {
    case 'vue':
      content = generateVueInit(rootPath, conf);
      break;
    case 'react':
      content = generateReactInit(rootPath, conf);
      break;
    case 'angular':
      content = generateAngularInit(rootPath, conf);
      break;
    default:
      return null;
  }

  fs.writeFileSync(fullPath, content);

  const written: WrittenFile = {
    absPath: fullPath,
    type: 'init',
  };

  logger.ndjson({
    stage: 'write',
    event: 'init',
    framework,
    path: path.relative(rootPath, fullPath),
  });

  return written;
}

// ── Source file rewriting ────────────────────────────────────────

function writeSourceFiles(
  rewritten: Map<string, string>,
  rootPath: string,
  dryRun: boolean
): WrittenFile[] {
  const written: WrittenFile[] = [];

  for (const [filePath, content] of rewritten) {
    if (!dryRun) {
      fs.writeFileSync(filePath, content);
    }

    written.push({
      absPath: filePath,
      type: 'source',
    });

    logger.ndjson({
      stage: 'write',
      event: 'source',
      file: path.relative(rootPath, filePath),
      dryRun,
    });
  }

  return written;
}

// ── Main writer stage ────────────────────────────────────────────

export interface WriteResult {
  written: WrittenFile[];
}

/**
 * Stage 6: Write all output files.
 */
export function write(
  rootPath: string,
  conf: I18nConfig,
  keyedEntries: KeyedEntry[],
  translationMap: TranslationMap,
  rewritten: Map<string, string>,
  dryRun: boolean = false
): WriteResult {
  const startTime = Date.now();
  const allWritten: WrittenFile[] = [];

  // 1. Write source files (unless dry run)
  allWritten.push(...writeSourceFiles(rewritten, rootPath, dryRun));

  // 2. Write locale JSON files
  allWritten.push(...writeLocaleFiles(rootPath, conf, translationMap));

  // 3. Write init file
  const initFile = writeInitFile(rootPath, conf);
  if (initFile) allWritten.push(initFile);

  const ms = Date.now() - startTime;
  logger.ndjson({
    stage: 'write',
    event: 'done',
    files: allWritten.length,
    dryRun,
    ms,
  });

  logger.progress(
    `Wrote ${allWritten.length} files${dryRun ? ' (dry-run)' : ''} in ${ms}ms`
  );

  return { written: allWritten };
}
