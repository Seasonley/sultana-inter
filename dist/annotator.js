"use strict";
/**
 * Pipeline stage 4: Annotator
 *
 * Rewrites source files by replacing Chinese text with framework-native call sites.
 * Handles imports, template literals with variables, string vs JSX text, etc.
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
exports.annotate = annotate;
const fs = __importStar(require("fs"));
const logger_1 = require("./logger");
// ── Call site generators per framework ────────────────────────────
function vueCallSite(key) {
    return `$t('${key}')`;
}
function reactCallSite(key) {
    return `t('${key}')`;
}
function angularCallSite(key) {
    return `{{ '${key}' | translate }}`;
}
function getCallSite(framework, key) {
    switch (framework) {
        case 'vue':
            return vueCallSite(key);
        case 'react':
            return reactCallSite(key);
        case 'angular':
            return angularCallSite(key);
    }
}
// ── Import statements per framework ───────────────────────────────
function vueImport() {
    return `import { useI18n } from 'vue-i18n';`;
}
function reactImport() {
    return `import { useTranslation } from 'react-i18next';`;
}
function angularImport() {
    return `import { TranslateModule } from '@ngx-translate/core';`;
}
/**
 * Stage 4: Rewrite source files with i18n call sites.
 *
 * For each file, groups entries by file, sorts by range descending
 * (to apply replacements from end to start, preserving earlier offsets),
 * and applies the replacements.
 */
function annotate(keyedEntries, conf) {
    const startTime = Date.now();
    const rewritten = new Map();
    const modifiedFiles = [];
    // Group entries by file
    const byFile = new Map();
    for (const entry of keyedEntries) {
        const list = byFile.get(entry.file) || [];
        list.push(entry);
        byFile.set(entry.file, list);
    }
    for (const [filePath, entries] of byFile) {
        let content = fs.readFileSync(filePath, 'utf-8');
        const framework = entries[0].framework;
        // Sort by range start descending (replace from end to start)
        const sorted = entries.sort((a, b) => b.range[0] - a.range[0]);
        for (const entry of sorted) {
            const [start, end] = entry.range;
            const before = content.slice(0, start);
            const after = content.slice(end);
            let replacement;
            if (entry.isString) {
                // String literal: check context for JSX attribute
                const charBefore = content.slice(start - 2, start);
                const isAttr = charBefore.includes('=');
                if (isAttr) {
                    // JSX/Vue attribute: = "text" → ={t('key')} or :attr="$t('key')"
                    if (framework === 'vue') {
                        replacement = `{${getCallSite(framework, entry.key)}}`;
                    }
                    else {
                        replacement = `{${getCallSite(framework, entry.key)}}`;
                    }
                }
                else if (entry.vars && entry.vars.length > 0) {
                    // Template literal with variables
                    if (framework === 'vue') {
                        const params = entry.vars
                            .map((v) => `${v.name}: ${v.expr}`)
                            .join(', ');
                        replacement = `$t('${entry.key}', { ${params} })`;
                    }
                    else if (framework === 'react') {
                        const params = entry.vars
                            .map((v) => `${v.name}: ${v.expr}`)
                            .join(', ');
                        replacement = `t('${entry.key}', { ${params} })`;
                    }
                    else {
                        replacement = getCallSite(framework, entry.key);
                    }
                }
                else {
                    replacement = getCallSite(framework, entry.key);
                }
            }
            else {
                // JSX text or template text
                replacement = getCallSite(framework, entry.key);
            }
            content = before + replacement + after;
        }
        // Add import statement at the top of the file
        let importLine = '';
        switch (framework) {
            case 'vue':
                importLine = vueImport();
                break;
            case 'react':
                importLine = reactImport();
                break;
            case 'angular':
                importLine = angularImport();
                break;
        }
        // Only add import if not already present and for non-HTML files
        if (importLine && !filePath.endsWith('.html') && !content.includes(importLine)) {
            if (framework === 'vue' && filePath.endsWith('.vue')) {
                // Vue SFC: insert import inside <script> block
                const scriptTagMatch = content.match(/<script[^>]*>/);
                if (scriptTagMatch) {
                    const insertPos = content.indexOf(scriptTagMatch[0]) + scriptTagMatch[0].length;
                    content =
                        content.slice(0, insertPos) +
                            '\n' +
                            importLine +
                            content.slice(insertPos);
                }
                else {
                    // No <script> tag found — create one before <template>
                    const templateMatch = content.match(/<template[^>]*>/);
                    if (templateMatch) {
                        const insertPos = content.indexOf(templateMatch[0]);
                        content =
                            content.slice(0, insertPos) +
                                '<script setup lang="ts">\n' +
                                importLine +
                                '\n</script>\n\n' +
                                content.slice(insertPos);
                    }
                    else {
                        content = importLine + '\n' + content;
                    }
                }
            }
            else {
                // React/Angular or non-SFC: insert after existing imports or at top
                const importRegex = /^(import\s.+from\s.+;?\s*$)/m;
                const firstImportMatch = content.match(importRegex);
                if (firstImportMatch) {
                    const insertPos = content.indexOf(firstImportMatch[0]) + firstImportMatch[0].length;
                    content =
                        content.slice(0, insertPos) +
                            '\n' +
                            importLine +
                            content.slice(insertPos);
                }
                else {
                    content = importLine + '\n' + content;
                }
            }
        }
        rewritten.set(filePath, content);
        modifiedFiles.push(filePath);
    }
    const ms = Date.now() - startTime;
    logger_1.logger.ndjson({
        stage: 'annotate',
        event: 'done',
        files: modifiedFiles.length,
        entries: keyedEntries.length,
        ms,
    });
    logger_1.logger.progress(`Annotated ${keyedEntries.length} entries in ${modifiedFiles.length} files in ${ms}ms`);
    return { rewritten, modifiedFiles };
}
//# sourceMappingURL=annotator.js.map