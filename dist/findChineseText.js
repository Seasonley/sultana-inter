"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @author linhuiw
 * @desc 利用 Ast 查找对应文件中的中文文案
 */
const ts = require("typescript");
const compiler = require("@angular/compiler");
const parserUtils_1 = require("./parserUtils");
const astUtils_1 = require("./astUtils");
const DOUBLE_BYTE_REGEX = /[^\x00-\xff]/g;
/**
 * 查找 Ts 文件中的中文
 * @param code
 */
function findTextInTs(code, fPath, conf) {
    const ext = fPath.slice(-3).replace('.', '').toUpperCase();
    const matches = [];
    const ast = ts.createSourceFile('', code, ts.ScriptTarget.ES2016, true, ts.ScriptKind[ext]);
    function visit(node) {
        switch (node.kind) {
            case ts.SyntaxKind.StringLiteral: {
                /** 判断 Ts 中的字符串含有中文 */
                const { text } = node;
                if (text.match(DOUBLE_BYTE_REGEX)) {
                    const start = node.getStart();
                    const end = node.getEnd();
                    /** 加一，减一的原因是，去除引号 */
                    matches.push({
                        range: [start + 1, end - 1],
                        text,
                        isString: true
                    });
                }
                break;
            }
            case ts.SyntaxKind.JsxElement: {
                const { children } = node;
                children.forEach(child => {
                    if (child.kind === ts.SyntaxKind.JsxText) {
                        const text = child.getText();
                        /** 修复注释含有中文的情况，Angular 文件错误的 Ast 情况 */
                        const noCommentText = astUtils_1.removeFileComment(text, fPath);
                        if (noCommentText.match(DOUBLE_BYTE_REGEX)) {
                            const start = child.getStart();
                            const end = child.getEnd();
                            const { trimStart, trimEnd } = parserUtils_1.trimWhiteSpace(code, start, end);
                            matches.push({
                                range: [trimStart, trimEnd],
                                text: text.trim(),
                                isString: false
                            });
                        }
                    }
                });
                break;
            }
            case ts.SyntaxKind.TemplateExpression: {
                const { pos, end } = node;
                const templateContent = code.slice(pos, end);
                if (templateContent.match(DOUBLE_BYTE_REGEX)) {
                    const start = node.getStart();
                    const end = node.getEnd();
                    /** 加一，减一的原因是，去除`号 */
                    matches.push({
                        range: [start + 1, end - 1],
                        text: code.slice(start + 1, end - 1),
                        isString: true
                    });
                }
            }
        }
        ts.forEachChild(node, visit);
    }
    ts.forEachChild(ast, visit);
    return matches;
}
/**
 * 查找 HTML 文件中的中文
 * @param code
 */
function findTextInHtml(code, fPath, conf) {
    const matches = [];
    const ast = compiler.parseTemplate(code, 'ast.html', {
        preserveWhitespaces: false
    });
    function visit(node) {
        const value = node.value;
        if (value && typeof value === 'string' && value.match(DOUBLE_BYTE_REGEX)) {
            const valueSpan = node.valueSpan || node.sourceSpan;
            let { start: { offset: startOffset }, end: { offset: endOffset } } = valueSpan;
            const nodeValue = code.slice(startOffset, endOffset);
            let startPos, endPos;
            let isString = false;
            /** 处理带引号的情况 */
            if (nodeValue.charAt(0) === '"' || nodeValue.charAt(0) === "'") {
                startPos = startOffset + 1;
                endPos = endOffset - 1;
                isString = true;
            }
            else {
                startPos = startOffset;
                endPos = endOffset;
            }
            const { trimStart, trimEnd } = parserUtils_1.trimWhiteSpace(code, startPos, endPos);
            matches.push({
                range: [trimStart, trimEnd],
                text: value,
                isString
            });
        }
        else if (value && typeof value === 'object' && value.source && value.source.match(DOUBLE_BYTE_REGEX)) {
            /**
             * <span>{{expression}}中文</span> 这种情况的兼容
             */
            const chineseMatches = value.source.match(DOUBLE_BYTE_REGEX);
            chineseMatches.map(match => {
                const valueSpan = node.valueSpan || node.sourceSpan;
                let { start: { offset: startOffset }, end: { offset: endOffset } } = valueSpan;
                const nodeValue = code.slice(startOffset, endOffset);
                const start = nodeValue.indexOf(match);
                const end = start + match.length;
                let startPos = startOffset + start;
                let endPos = startOffset + end;
                const { trimStart, trimEnd } = parserUtils_1.trimWhiteSpace(code, startPos, endPos);
                matches.push({
                    range: [trimStart, trimEnd],
                    text: match[0],
                    isString: false
                });
            });
        }
        if (node.children && node.children.length) {
            node.children.forEach(visit);
        }
        if (node.attributes && node.attributes.length) {
            node.attributes.forEach(visit);
        }
    }
    if (ast.nodes && ast.nodes.length) {
        ast.nodes.forEach(visit);
    }
    return matches;
}
/**
 * 递归匹配代码的中文
 * @param code
 */
function findChineseText(code, fPath, conf) {
    if (fPath.endsWith('.html')) {
        return findTextInHtml(code, fPath, conf);
    }
    return findTextInTs(code, fPath, conf);
}
exports.default = findChineseText;
//# sourceMappingURL=findChineseText.js.map