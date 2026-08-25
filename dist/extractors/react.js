"use strict";
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
exports.extractReact = extractReact;
const ts = __importStar(require("typescript"));
const logger_1 = require("../logger");
const DOUBLE_BYTE_REGEX = /[^\x00-\xff]/g;
/**
 * 从 React/TSX/JSX 文件中提取硬编码的中文文本
 */
function extractReact(filePath, relPath, content) {
    const ext = filePath.slice(-4).replace('.', '').toUpperCase();
    const entries = [];
    // 创建 AST
    const ast = ts.createSourceFile(filePath, content, ts.ScriptTarget.ES2016, true, ts.ScriptKind[ext]);
    // 用于生成顺序键的计数器
    let counter = 0;
    /**
     * 检查节点是否在 import/require/import() 语句中
     */
    function isInImportStatement(node) {
        let current = node;
        while (current) {
            if (ts.isImportDeclaration(current) ||
                (ts.isCallExpression(current) &&
                    (current.expression.getText() === 'require' ||
                        current.expression.getText() === 'import'))) {
                return true;
            }
            current = current.parent;
        }
        return false;
    }
    /**
     * 检查字符串是否已经被 t() 或 $t() 包装
     */
    function isWrappedInTranslationFunction(node) {
        const parent = node.parent;
        if (!parent)
            return false;
        if (ts.isCallExpression(parent)) {
            const expression = parent.expression;
            if (ts.isIdentifier(expression)) {
                const name = expression.getText();
                if (name === 't' || name === '$t') {
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * 提取模板字符串中的变量（${...}）
     */
    function extractTemplateVars(text) {
        const vars = [];
        const regex = /\$\{([^}]+)\}/g;
        let match;
        let idx = 1;
        while ((match = regex.exec(text)) !== null) {
            vars.push({ name: `val${idx}`, expr: match[1].trim() });
            idx++;
        }
        return vars;
    }
    /**
     * 清理文本（移除 JSX 注释等）
     */
    function cleanText(text) {
        // 简单清理：移除多余的空格和换行
        return text.replace(/\s+/g, ' ').trim();
    }
    /**
     * 处理字符串字面量节点
     */
    function handleStringLiteral(node) {
        if (isInImportStatement(node) || isWrappedInTranslationFunction(node)) {
            return;
        }
        const { text } = node;
        if (!text.match(DOUBLE_BYTE_REGEX)) {
            return;
        }
        const start = node.getStart();
        const end = node.getEnd();
        // 范围不包括引号
        const rangeStart = start + 1;
        const rangeEnd = end - 1;
        const rangeText = content.slice(rangeStart, rangeEnd);
        counter++;
        const entry = {
            file: filePath,
            relPath,
            originalKey: `${relPath.replace(/\//g, '.').replace(/\.tsx?$/, '')}.${counter}`,
            text,
            range: [rangeStart, rangeEnd],
            callSiteType: 'string',
            framework: 'react',
            isString: true,
            vars: []
        };
        entries.push(entry);
    }
    /**
     * 处理 JSX 元素的文本子节点
     */
    function handleJsxElement(node) {
        const { children } = node;
        children.forEach((child) => {
            if (child.kind === ts.SyntaxKind.JsxText) {
                const jsxText = child;
                const rawText = jsxText.getText();
                if (isWrappedInTranslationFunction(child)) {
                    return;
                }
                if (rawText.match(DOUBLE_BYTE_REGEX)) {
                    const cleanedText = cleanText(rawText);
                    const start = child.getStart();
                    const end = child.getEnd();
                    // 计算清理后文本在原始文本中的位置偏移
                    const beforeTrim = content.slice(0, start);
                    const trimmedText = rawText.trimStart();
                    const offset = rawText.length - trimmedText.length;
                    const trimStart = start + offset;
                    const trimEnd = end;
                    counter++;
                    const entry = {
                        file: filePath,
                        relPath,
                        originalKey: `${relPath.replace(/\//g, '.').replace(/\.tsx?$/, '')}.${counter}`,
                        text: cleanedText,
                        range: [trimStart, trimEnd],
                        callSiteType: 'jsx-text',
                        framework: 'react',
                        isString: false,
                        vars: []
                    };
                    entries.push(entry);
                }
            }
        });
    }
    /**
     * 处理 JSX 属性值中的字符串
     */
    function handleJsxAttribute(node) {
        const { initializer } = node;
        if (!initializer)
            return;
        if (ts.isStringLiteral(initializer)) {
            if (isInImportStatement(initializer) || isWrappedInTranslationFunction(initializer)) {
                return;
            }
            const { text } = initializer;
            if (!text.match(DOUBLE_BYTE_REGEX)) {
                return;
            }
            const start = initializer.getStart();
            const end = initializer.getEnd();
            const rangeStart = start + 1;
            const rangeEnd = end - 1;
            counter++;
            const entry = {
                file: filePath,
                relPath,
                originalKey: `${relPath.replace(/\//g, '.').replace(/\.tsx?$/, '')}.${counter}`,
                text,
                range: [rangeStart, rangeEnd],
                callSiteType: 'jsx-attr',
                framework: 'react',
                isString: true,
                vars: []
            };
            entries.push(entry);
        }
    }
    /**
     * 处理模板表达式
     */
    function handleTemplateExpression(node) {
        if (isWrappedInTranslationFunction(node)) {
            return;
        }
        const { pos, end } = node;
        const templateContent = content.slice(pos, end);
        if (templateContent.match(DOUBLE_BYTE_REGEX)) {
            const start = node.getStart();
            const nodeEnd = node.getEnd();
            const rangeStart = start + 1; // 跳过开头的反引号
            const rangeEnd = nodeEnd - 1; // 跳过结尾的反引号
            const fullText = content.slice(rangeStart, rangeEnd);
            const vars = extractTemplateVars(fullText);
            counter++;
            const entry = {
                file: filePath,
                relPath,
                originalKey: `${relPath.replace(/\//g, '.').replace(/\.tsx?$/, '')}.${counter}`,
                text: fullText,
                range: [rangeStart, rangeEnd],
                callSiteType: 'string',
                framework: 'react',
                isString: true,
                vars
            };
            entries.push(entry);
        }
    }
    /**
     * AST 访问函数
     */
    function visit(node) {
        switch (node.kind) {
            case ts.SyntaxKind.StringLiteral:
                handleStringLiteral(node);
                break;
            case ts.SyntaxKind.JsxElement:
                handleJsxElement(node);
                break;
            case ts.SyntaxKind.JsxAttribute:
                handleJsxAttribute(node);
                break;
            case ts.SyntaxKind.TemplateExpression:
                handleTemplateExpression(node);
                break;
        }
        ts.forEachChild(node, visit);
    }
    // 开始遍历 AST
    ts.forEachChild(ast, visit);
    if (entries.length > 0) {
        logger_1.logger.progress(`Extracted ${entries.length} Chinese entries from ${relPath}`);
    }
    return entries;
}
//# sourceMappingURL=react.js.map