import * as ts from 'typescript';
import { ExtractedEntry, CallSiteType, Framework } from '../types';
import { logger } from '../logger';

const DOUBLE_BYTE_REGEX = /[^\x00-\xff]/g;

/**
 * 从 React/TSX/JSX 文件中提取硬编码的中文文本
 */
export function extractReact(
  filePath: string,
  relPath: string,
  content: string
): ExtractedEntry[] {
  const ext = filePath.slice(-4).replace('.', '').toUpperCase() as 'JSX' | 'TSX';
  const entries: ExtractedEntry[] = [];
  
  // 创建 AST
  const ast = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.ES2016,
    true,
    ts.ScriptKind[ext]
  );

  // 用于生成顺序键的计数器
  let counter = 0;

  /**
   * 检查节点是否在 import/require/import() 语句中
   */
  function isInImportStatement(node: ts.Node): boolean {
    let current: ts.Node | undefined = node;
    while (current) {
      if (
        ts.isImportDeclaration(current) ||
        (ts.isCallExpression(current) &&
          (current.expression.getText() === 'require' ||
            current.expression.getText() === 'import'))
      ) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * 检查字符串是否已经被 t() 或 $t() 包装
   */
  function isWrappedInTranslationFunction(node: ts.Node): boolean {
    const parent = node.parent;
    if (!parent) return false;

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
  function extractTemplateVars(text: string): Array<{ name: string; expr: string }> {
    const vars: Array<{ name: string; expr: string }> = [];
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
  function cleanText(text: string): string {
    // 简单清理：移除多余的空格和换行
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * 处理字符串字面量节点
   */
  function handleStringLiteral(node: ts.StringLiteral): void {
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
    const entry: ExtractedEntry = {
      file: filePath,
      relPath,
      originalKey: `${relPath.replace(/\//g, '.').replace(/\.tsx?$/, '')}.${counter}`,
      text,
      range: [rangeStart, rangeEnd],
      callSiteType: 'string' as CallSiteType,
      framework: 'react' as Framework,
      isString: true,
      vars: []
    };

    entries.push(entry);
  }

  /**
   * 处理 JSX 元素的文本子节点
   */
  function handleJsxElement(node: ts.JsxElement): void {
    const { children } = node;
    children.forEach((child) => {
      if (child.kind === ts.SyntaxKind.JsxText) {
        const jsxText = child as ts.JsxText;
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
          const entry: ExtractedEntry = {
            file: filePath,
            relPath,
            originalKey: `${relPath.replace(/\//g, '.').replace(/\.tsx?$/, '')}.${counter}`,
            text: cleanedText,
            range: [trimStart, trimEnd],
            callSiteType: 'jsx-text' as CallSiteType,
            framework: 'react' as Framework,
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
  function handleJsxAttribute(node: ts.JsxAttribute): void {
    const { initializer } = node;
    if (!initializer) return;

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
      const entry: ExtractedEntry = {
        file: filePath,
        relPath,
        originalKey: `${relPath.replace(/\//g, '.').replace(/\.tsx?$/, '')}.${counter}`,
        text,
        range: [rangeStart, rangeEnd],
        callSiteType: 'jsx-attr' as CallSiteType,
        framework: 'react' as Framework,
        isString: true,
        vars: []
      };

      entries.push(entry);
    }
  }

  /**
   * 处理模板表达式
   */
  function handleTemplateExpression(node: ts.TemplateExpression): void {
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
      const entry: ExtractedEntry = {
        file: filePath,
        relPath,
        originalKey: `${relPath.replace(/\//g, '.').replace(/\.tsx?$/, '')}.${counter}`,
        text: fullText,
        range: [rangeStart, rangeEnd],
        callSiteType: 'string' as CallSiteType,
        framework: 'react' as Framework,
        isString: true,
        vars
      };

      entries.push(entry);
    }
  }

  /**
   * AST 访问函数
   */
  function visit(node: ts.Node): void {
    switch (node.kind) {
      case ts.SyntaxKind.StringLiteral:
        handleStringLiteral(node as ts.StringLiteral);
        break;

      case ts.SyntaxKind.JsxElement:
        handleJsxElement(node as ts.JsxElement);
        break;

      case ts.SyntaxKind.JsxAttribute:
        handleJsxAttribute(node as ts.JsxAttribute);
        break;

      case ts.SyntaxKind.TemplateExpression:
        handleTemplateExpression(node as ts.TemplateExpression);
        break;
    }

    ts.forEachChild(node, visit);
  }

  // 开始遍历 AST
  ts.forEachChild(ast, visit);

  if (entries.length > 0) {
    logger.progress(`Extracted ${entries.length} Chinese entries from ${relPath}`);
  }
  
  return entries;
}
