"use strict";
/**
 * Pipeline stage 2: Extractor
 *
 * Dispatches to framework-specific extractors and aggregates results.
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
exports.extract = extract;
const fs = __importStar(require("fs"));
const react_1 = require("./extractors/react");
const angular_1 = require("./extractors/angular");
const vue_1 = require("./extractors/vue");
const logger_1 = require("./logger");
/**
 * Stage 2: Extract hardcoded Chinese text from all scanned files.
 */
function extract(files, rootPath, _conf) {
    const startTime = Date.now();
    const allEntries = [];
    for (const file of files) {
        const content = fs.readFileSync(file.absPath, 'utf-8');
        let entries = [];
        switch (file.framework) {
            case 'react':
                entries = (0, react_1.extractReact)(file.absPath, file.relPath, content);
                break;
            case 'angular':
                entries = (0, angular_1.extractAngular)(file.absPath, file.relPath, content);
                break;
            case 'vue':
                entries = (0, vue_1.extractVue)(file.absPath, file.relPath, content);
                break;
        }
        if (entries.length > 0) {
            logger_1.logger.ndjson({
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
    logger_1.logger.ndjson({
        stage: 'extract',
        event: 'done',
        files: files.length,
        entries: allEntries.length,
        ms,
    });
    logger_1.logger.progress(`Extracted ${allEntries.length} Chinese entries from ${files.length} files in ${ms}ms`);
    return allEntries;
}
//# sourceMappingURL=extractor.js.map