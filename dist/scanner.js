"use strict";
/**
 * Pipeline stage 1: Scanner
 *
 * Walks the project tree, applies include/exclude globs,
 * classifies files by framework, emits NDJSON log.
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
exports.scan = scan;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const micromatch = __importStar(require("micromatch"));
const logger_1 = require("./logger");
const FRAMEWORK_EXT_MAP = {
    '.vue': 'vue',
    '.tsx': 'react',
    '.jsx': 'react',
    '.html': 'angular',
};
/**
 * Detect framework from file extension.
 * Returns undefined for ambiguous extensions (.ts, .js).
 */
function frameworkFromExt(ext) {
    return FRAMEWORK_EXT_MAP[ext];
}
/**
 * Detect framework for Angular by checking if the HTML file
 * is referenced by an Angular component (heuristic: presence of
 * component decorator or .component. in filename).
 */
function isAngularHtml(filePath) {
    const basename = path.basename(filePath).toLowerCase();
    return basename.includes('.component.');
}
/**
 * Recursively walk directory and collect matching files.
 */
function walkDir(dir, rootPath, conf) {
    const results = [];
    function walk(currentDir) {
        let entries;
        try {
            entries = fs.readdirSync(currentDir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const absPath = path.join(currentDir, entry.name);
            const relPath = absPath.replace(rootPath, '').replace(/\\/g, '/').replace(/^\//, '');
            if (entry.isDirectory()) {
                walk(absPath);
                continue;
            }
            if (!entry.isFile())
                continue;
            // Apply include/exclude globs
            if (!micromatch.isMatch(relPath, conf.include))
                continue;
            if (micromatch.isMatch(relPath, conf.exclude))
                continue;
            const ext = path.extname(entry.name).toLowerCase();
            // Only process known extensions
            if (!['.vue', '.tsx', '.jsx', '.ts', '.js', '.html'].includes(ext))
                continue;
            let framework = frameworkFromExt(ext);
            // Ambiguous extensions: use project default
            if (!framework) {
                if (conf.framework) {
                    framework = conf.framework;
                }
                else {
                    // Skip ambiguous files with warning
                    logger_1.logger.log('warn', 'scan', `Skipping ambiguous file (no framework): ${relPath}`);
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
function scan(rootPath, conf) {
    const startTime = Date.now();
    const files = walkDir(rootPath, rootPath, conf);
    const ms = Date.now() - startTime;
    // Group by framework for logging
    const byFramework = {};
    for (const f of files) {
        byFramework[f.framework] = (byFramework[f.framework] || 0) + 1;
    }
    logger_1.logger.ndjson({
        stage: 'scan',
        event: 'done',
        total: files.length,
        byFramework,
        ms,
    });
    logger_1.logger.progress(`Scanned ${files.length} files (${Object.entries(byFramework)
        .map(([k, v]) => `${k}:${v}`)
        .join(', ')}) in ${ms}ms`);
    return files;
}
//# sourceMappingURL=scanner.js.map