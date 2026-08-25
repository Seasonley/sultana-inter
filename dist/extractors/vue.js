"use strict";
/**
 * Vue SFC (Single File Component) Chinese text extractor.
 * Ported from ev-i18n's Babel AST + Vue SFC parsing logic.
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
exports.extractVue = extractVue;
const logger_1 = require("../logger");
const parser = __importStar(require("@babel/parser"));
const traverse = __importStar(require("@babel/traverse"));
const t = __importStar(require("@babel/types"));
const compiler_sfc_1 = require("@vue/compiler-sfc");
const compiler_dom_1 = require("@vue/compiler-dom");
/**
 * Check if a string contains Chinese characters.
 */
function containsChinese(str) {
    return /[\u4e00-\u9fa5]/.test(str);
}
/**
 * Generate key prefix from relative file path.
 */
function getKeyPrefix(filePath, rootPath) {
    // Remove file extension and normalize path separators
    let prefix = filePath.replace(/\.vue$/, '').replace(/\\/g, '/');
    // Remove leading './' or '/'
    prefix = prefix.replace(/^\.\//, '').replace(/^\//, '');
    return prefix;
}
/**
 * Extract Chinese text from Vue template nodes.
 * Handles text nodes (type 2) and attribute values (type 6).
 * Splits text on interpolation boundaries to get pure Chinese segments.
 */
function extractFromTemplate(templateContent, templateStart, relPath, filePath, counter) {
    const entries = [];
    // Parse template content with location information
    const templateAst = (0, compiler_dom_1.parse)(templateContent, {
        comments: true,
        parseMode: 'html',
        whitespace: 'condense',
        nodeTransforms: [],
    });
    // Recursively walk nodes
    function walkNode(node) {
        if (!node)
            return;
        // Handle text nodes (type 2)
        if (node.type === 2 && typeof node.content === 'string') {
            const text = node.content.trim();
            if (!text)
                return;
            // Skip pure interpolation nodes (type 5)
            if (/^{{\s*[^}]*\s*}}$/.test(text))
                return;
            if (containsChinese(text)) {
                // Find position in original template content
                const nodeStart = node.loc.start.offset;
                const nodeEnd = node.loc.end.offset;
                const absoluteStart = templateStart + nodeStart;
                const absoluteEnd = templateStart + nodeEnd;
                // Split text on interpolation boundaries
                const segments = [];
                let lastIndex = 0;
                const regex = /({{\s*[^}]*\s*}})/g;
                let match;
                while ((match = regex.exec(node.content)) !== null) {
                    // Text before interpolation
                    const textBefore = node.content.slice(lastIndex, match.index);
                    if (textBefore) {
                        segments.push({ type: 'text', content: textBefore, start: lastIndex });
                    }
                    // Interpolation
                    segments.push({ type: 'interpolation', content: match[1], start: match.index });
                    lastIndex = match.index + match[0].length;
                }
                // Remaining text
                const remainingText = node.content.slice(lastIndex);
                if (remainingText) {
                    segments.push({ type: 'text', content: remainingText, start: lastIndex });
                }
                // Extract Chinese segments only
                for (const segment of segments) {
                    if (segment.type === 'text' && containsChinese(segment.content)) {
                        counter.value++;
                        entries.push({
                            file: filePath,
                            relPath,
                            originalKey: `${getKeyPrefix(relPath)}.${counter.value}`,
                            text: segment.content,
                            range: [
                                templateStart + nodeStart + segment.start,
                                templateStart + nodeStart + segment.start + segment.content.length,
                            ],
                            callSiteType: 'vue-template',
                            framework: 'vue',
                            isString: false,
                        });
                    }
                }
            }
        }
        // Handle attribute nodes (type 6)
        if (node.type === 6 && node.name && node.value && node.value.content) {
            const value = node.value.content;
            if (containsChinese(value)) {
                // Include quotes in range
                const valueStart = node.value.loc.start.offset;
                const valueEnd = node.value.loc.end.offset;
                const absoluteStart = templateStart + valueStart;
                const absoluteEnd = templateStart + valueEnd;
                counter.value++;
                entries.push({
                    file: filePath,
                    relPath,
                    originalKey: `${getKeyPrefix(relPath)}.${counter.value}`,
                    text: value,
                    range: [absoluteStart, absoluteEnd],
                    callSiteType: 'vue-attr',
                    framework: 'vue',
                    isString: true,
                });
            }
        }
        // Recurse into children
        if (node.children) {
            for (const child of node.children) {
                walkNode(child);
            }
        }
        // Handle props (Vue 3)
        if (node.props) {
            for (const prop of node.props) {
                walkNode(prop);
            }
        }
        // Handle attrs (Vue 2)
        if (node.attrs) {
            for (const attr of node.attrs) {
                walkNode(attr);
            }
        }
    }
    // Start walking from children
    for (const child of templateAst.children) {
        walkNode(child);
    }
    return entries;
}
/**
 * Extract Chinese text from script AST.
 * Handles StringLiteral and TemplateLiteral nodes.
 */
function extractFromScript(scriptContent, scriptStart, relPath, filePath, counter) {
    const entries = [];
    try {
        // Parse script with Babel
        const ast = parser.parse(scriptContent, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
        });
        // Walk AST
        traverse.default(ast, {
            StringLiteral(path) {
                const node = path.node;
                const value = node.value;
                // Skip empty strings or non-Chinese
                if (!value || !containsChinese(value)) {
                    return;
                }
                // Skip import/require paths
                const parent = path.parent;
                if (t.isImportDeclaration(parent) ||
                    (t.isCallExpression(parent) &&
                        t.isIdentifier(parent.callee) &&
                        (parent.callee.name === 'require' || parent.callee.name === 'import'))) {
                    return;
                }
                // Skip existing i18n calls like $t(), t(), $t()
                if (t.isCallExpression(parent) &&
                    t.isMemberExpression(parent.callee) &&
                    t.isIdentifier(parent.callee.property) &&
                    (parent.callee.property.name === 't' || parent.callee.property.name === '$t')) {
                    return;
                }
                // Get source location
                const start = node.start;
                const end = node.end;
                // The range should include the quotes
                counter.value++;
                entries.push({
                    file: filePath,
                    relPath,
                    originalKey: `${getKeyPrefix(relPath)}.${counter.value}`,
                    text: value,
                    range: [scriptStart + start, scriptStart + end],
                    callSiteType: 'string',
                    framework: 'vue',
                    isString: true,
                });
            },
            TemplateLiteral(path) {
                const node = path.node;
                let hasChinese = false;
                let fullText = '';
                // Check if any quasi part contains Chinese
                for (const quasi of node.quasis) {
                    if (containsChinese(quasi.value.raw)) {
                        hasChinese = true;
                        fullText += quasi.value.raw;
                    }
                }
                if (!hasChinese) {
                    return;
                }
                // Skip import contexts (template literals in import expressions)
                const parent = path.parent;
                if (t.isImportDeclaration(parent)) {
                    return;
                }
                const start = node.start;
                const end = node.end;
                counter.value++;
                entries.push({
                    file: filePath,
                    relPath,
                    originalKey: `${getKeyPrefix(relPath)}.${counter.value}`,
                    text: fullText,
                    range: [scriptStart + start, scriptStart + end],
                    callSiteType: 'string',
                    framework: 'vue',
                    isString: false,
                    vars: node.expressions.map((expr) => ({
                        name: `var${node.expressions.indexOf(expr)}`,
                        expr: scriptContent.substring(expr.start, expr.end),
                    })),
                });
            },
        });
    }
    catch (error) {
        logger_1.logger.log('error', 'vue-script-parse', `Failed to parse script in ${relPath}: ${error}`);
    }
    return entries;
}
/**
 * Extract hardcoded Chinese text from a Vue SFC file.
 */
function extractVue(filePath, relPath, content) {
    const entries = [];
    const counter = { value: 0 };
    try {
        // Parse Vue SFC
        const { descriptor, errors } = (0, compiler_sfc_1.parse)(content);
        if (errors.length > 0) {
            logger_1.logger.log('warn', 'vue-parse', `Parse warnings for ${relPath}`, {
                errors: errors.map((e) => e.message),
            });
        }
        // Process template block
        if (descriptor.template) {
            const template = descriptor.template;
            const templateContent = template.content;
            // Calculate template start position in original content
            // We need to find the position of <template> tag
            const templateStart = content.indexOf('<template');
            if (templateStart !== -1) {
                // Find the closing > of the opening tag
                const tagEnd = content.indexOf('>', templateStart);
                if (tagEnd !== -1) {
                    const contentStart = tagEnd + 1;
                    const templateEntries = extractFromTemplate(templateContent, contentStart, relPath, filePath, counter);
                    entries.push(...templateEntries);
                }
            }
        }
        // Process script blocks
        const scriptBlocks = [
            descriptor.script,
            descriptor.scriptSetup,
        ].filter(Boolean);
        for (const script of scriptBlocks) {
            // Calculate script start position in original content
            const scriptTag = script.setup ? 'script setup' : 'script';
            const scriptStart = content.indexOf(`<${scriptTag}`);
            if (scriptStart !== -1) {
                const tagEnd = content.indexOf('>', scriptStart);
                if (tagEnd !== -1) {
                    const contentStart = tagEnd + 1;
                    const scriptEntries = extractFromScript(script.content, contentStart, relPath, filePath, counter);
                    entries.push(...scriptEntries);
                }
            }
        }
    }
    catch (error) {
        logger_1.logger.log('error', 'vue-extract', `Failed to extract from ${relPath}: ${error}`);
    }
    return entries;
}
//# sourceMappingURL=vue.js.map