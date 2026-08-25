/**
 * Angular 模板提取器
 *
 * 利用 @angular/compiler 的 parseTemplate 解析 Angular HTML 模板，
 * 提取其中硬编码的中文文本，返回标准化的 ExtractedEntry 数组。
 *
 * 支持两种文件类型：
 *   - .html 文件：直接解析 HTML 模板
 *   - .ts 文件：从 @Component 装饰器中提取内联模板并解析
 */
import * as compiler from '@angular/compiler';
import * as ts from 'typescript';
import { ExtractedEntry, CallSiteType, Framework } from '../types';
import { logger } from '../logger';

// ── 正则 ──────────────────────────────────────────────────────────

/** 匹配双字节字符（中文、日文、韩文等） */
const DOUBLE_BYTE_REGEX = /[^\x00-\xff]/g;

// ── 内部工具 ──────────────────────────────────────────────────────

/**
 * 解码常见的 HTML 实体字符。
 * 例如: '你&nbsp;好' → '你\u00a0好'
 *
 * 保留原始实体字符串用于最终输出，此函数仅用于
 * 判断文本是否包含中文字符的中间检测环节。
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, '\u00a0')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&ensp;/g, '\u2002')
    .replace(/&emsp;/g, '\u2003')
    .replace(/&thinsp;/g, '\u2009')
    .replace(/&copy;/g, '\u00a9')
    .replace(/&reg;/g, '\u00ae')
    .replace(/&trade;/g, '\u2122')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&laquo;/g, '\u00ab')
    .replace(/&raquo;/g, '\u00bb')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&ldquo;/g, '\u201c')
    .replace(/&rdquo;/g, '\u201d')
    .replace(/&hellip;/g, '\u2026')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * 裁剪指定范围内的首尾空白字符，返回裁剪后的起止偏移量。
 * 与项目中 parserUtils.trimWhiteSpace 逻辑一致，此处内联以便独立使用。
 */
function trimWhiteSpace(
  code: string,
  startPos: number,
  endPos: number,
): { trimStart: number; trimEnd: number } {
  const initStr = code.slice(startPos, endPos);
  const accStart = (initStr.match(/^\s+/) || [''])[0].length;
  const accEnd = (initStr.match(/\s+$/) || [''])[0].length;
  return {
    trimStart: startPos + accStart,
    trimEnd: endPos - accEnd,
  };
}

/**
 * 根据文件相对路径生成 key 基础前缀。
 * 例: 'src/app/home.component.html' → 'src/app/home.component'
 */
function deriveBasePath(relPath: string): string {
  return relPath.replace(/\.[^/.]+$/, '');
}

// ── 内联模板提取（从 .ts 文件中） ──────────────────────────────────

interface InlineTemplate {
  /** 模板字符串内容 */
  template: string;
  /** 模板字符串在 .ts 文件中的起始偏移量（不含引号） */
  startOffset: number;
  /** 模板字符串在 .ts 文件中的结束偏移量（不含引号） */
  endOffset: number;
}

/**
 * 从 TypeScript 源码中提取 @Component 装饰器里的内联模板字符串。
 *
 * 支持以下写法：
 *   - @Component({ template: '...' })
 *   - @Component({ template: `...` })
 *   - @Component({ selector: '...', template: '...' })
 *   - 带换行的模板字面量
 *
 * @param tsContent .ts 文件的完整内容
 * @returns 提取到的内联模板数组
 */
function extractInlineTemplatesFromTS(tsContent: string): InlineTemplate[] {
  const results: InlineTemplate[] = [];

  const sourceFile = ts.createSourceFile(
    'component.ts',
    tsContent,
    ts.ScriptTarget.Latest,
    true, // setParentNodes
  );

  /**
   * 递归遍历 AST 查找 @Component 装饰器中的 template 属性。
   */
  function visit(node: ts.Node): void {
    // 查找装饰器表达式: @Component(...)
    if (
      ts.isCallExpression(node) &&
      ts.isDecorator(node) === false
    ) {
      // 不太可能直接匹配，装饰器通常在类上
    }

    // 查找类声明上的装饰器
    if (ts.isClassDeclaration(node)) {
      // 使用 node.modifiers 而非 ts.getModifiers()，
      // 因为后者在 TypeScript 5.x 中不再包含装饰器
      const allModifiers = (node as any).modifiers as ts.NodeArray<ts.ModifierLike> | undefined;
      if (allModifiers) {
        for (const mod of allModifiers) {
          if (ts.isDecorator(mod)) {
            extractTemplateFromDecorator(mod, tsContent, results);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return results;
}

/**
 * 从单个装饰器表达式中提取 template 属性的字符串值。
 */
function extractTemplateFromDecorator(
  decorator: ts.Decorator,
  tsContent: string,
  results: InlineTemplate[],
): void {
  const expression = decorator.expression;
  if (!ts.isCallExpression(expression)) return;

  const args = expression.arguments;
  if (args.length === 0 || !ts.isObjectLiteralExpression(args[0])) return;

  const objectLiteral = args[0];

  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) continue;

    // 检查属性名是否为 "template"
    const name = property.name;
    const propName =
      ts.isIdentifier(name) ? name.text :
      ts.isStringLiteral(name) ? name.text : '';

    if (propName !== 'template') continue;

    // 提取字符串值
    const init = property.initializer;
    let templateText: string | undefined;
    let startOffset: number;
    let endOffset: number;

    if (ts.isStringLiteral(init)) {
      // template: '...' 或 template: "..."
      templateText = init.text;
      // init.getStart() 返回引号前的位置，init.getEnd() 返回引号后的位置
      // 模板内容从引号后开始，到引号前结束
      startOffset = init.getStart() + 1; // 跳过开头引号
      endOffset = init.getEnd() - 1;     // 不含结尾引号
    } else if (ts.isNoSubstitutionTemplateLiteral(init)) {
      // template: `...` （无插值的模板字面量）
      templateText = init.text;
      startOffset = init.getStart() + 1; // 跳过开头反引号
      endOffset = init.getEnd() - 1;     // 不含结尾反引号
    } else {
      // 其他类型（变量引用等），跳过
      continue;
    }

    if (templateText !== undefined) {
      results.push({
        template: templateText,
        startOffset,
        endOffset,
      });
    }
  }
}

// ── AST 遍历 ──────────────────────────────────────────────────────

interface RawMatch {
  range: [number, number];
  text: string;
  isString: boolean;
}

/**
 * 递归遍历 Angular Compiler 产出的模板 AST 节点，
 * 收集所有包含中文字符的文本片段。
 */
function visitNodes(
  nodes: any[],
  code: string,
  matches: RawMatch[],
): void {
  for (const node of nodes) {
    const value: unknown = (node as Record<string, unknown>).value;

    // ── 情况 1: 纯字符串值 ──
    if (value && typeof value === 'string') {
      // 使用解码后的文本检测是否包含中文字符
      const decoded = decodeHtmlEntities(value);
      if (DOUBLE_BYTE_REGEX.test(decoded)) {
        // 重置 lastIndex（因为使用了 /g 标志）
        DOUBLE_BYTE_REGEX.lastIndex = 0;

        const valueSpan = (node as Record<string, unknown>).valueSpan ||
          (node as Record<string, unknown>).sourceSpan;
        if (!valueSpan) continue;

        const {
          start: { offset: startOffset },
          end: { offset: endOffset },
        } = valueSpan as { start: { offset: number }; end: { offset: number } };

        const nodeValue = code.slice(startOffset, endOffset);
        let startPos: number;
        let endPos: number;
        let isString = false;

        // 处理带引号的情况
        if (
          nodeValue.charAt(0) === '"' ||
          nodeValue.charAt(0) === "'"
        ) {
          startPos = startOffset + 1;
          endPos = endOffset - 1;
          isString = true;
        } else {
          startPos = startOffset;
          endPos = endOffset;
        }

        const { trimStart, trimEnd } = trimWhiteSpace(code, startPos, endPos);
        matches.push({ range: [trimStart, trimEnd], text: value, isString });
      }
    }

    // ── 情况 2: 插值表达式中包含中文（如 {{expr}}中文）──
    // value 为 Interpolation 类型时 source 字段包含完整源码
    if (
      value &&
      typeof value === 'object' &&
      (value as Record<string, unknown>).source
    ) {
      const src = (value as Record<string, unknown>).source as string;
      // 使用解码后的文本检测中文
      const decodedSrc = decodeHtmlEntities(src);
      const chineseMatches = decodedSrc.match(DOUBLE_BYTE_REGEX);
      if (chineseMatches) {
        const valueSpan = (node as Record<string, unknown>).valueSpan ||
          (node as Record<string, unknown>).sourceSpan;
        if (!valueSpan) continue;

        const {
          start: { offset: startOffset },
          end: { offset: endOffset },
        } = valueSpan as { start: { offset: number }; end: { offset: number } };

        const nodeValue = code.slice(startOffset, endOffset);

        for (const match of chineseMatches) {
          const idx = nodeValue.indexOf(match);
          if (idx === -1) continue;
          const start = idx;
          const end = start + match.length;
          const startPos = startOffset + start;
          const endPos = startOffset + end;
          const { trimStart, trimEnd } = trimWhiteSpace(code, startPos, endPos);
          matches.push({
            range: [trimStart, trimEnd],
            text: match,
            isString: false,
          });
        }
      }
    }

    // ── 递归子节点 ──
    const children = (node as Record<string, unknown>).children as
      | any[]
      | undefined;
    if (children && children.length) {
      visitNodes(children, code, matches);
    }

    const attributes = (node as Record<string, unknown>).attributes as
      | any[]
      | undefined;
    if (attributes && attributes.length) {
      visitNodes(attributes, code, matches);
    }
  }
}

// ── 公开接口 ──────────────────────────────────────────────────────

/**
 * 解析模板内容并返回 ExtractedEntry 数组。
 *
 * @param templateContent  模板字符串（HTML 源码）
 * @param filePath         文件绝对路径
 * @param relPath          相对于项目根目录的相对路径
 * @param callSiteType     调用点类型
 * @returns                ExtractedEntry 数组
 */
function parseTemplateAndExtract(
  templateContent: string,
  filePath: string,
  relPath: string,
  callSiteType: CallSiteType,
): ExtractedEntry[] {
  const entries: ExtractedEntry[] = [];
  const framework: Framework = 'angular';
  const basePath = deriveBasePath(relPath);

  let ast: any;
  try {
    ast = compiler.parseTemplate(templateContent, 'template.html', {
      preserveWhitespaces: false,
    } as any);
  } catch (err) {
    logger.log('warn', 'angular-extract', `parseTemplate 失败: ${relPath}`, {
      error: String(err),
    });
    return entries;
  }

  // ── 收集原始匹配 ──
  const rawMatches: RawMatch[] = [];
  if (ast.nodes && ast.nodes.length) {
    visitNodes(ast.nodes, templateContent, rawMatches);
  }

  // ── 转换为 ExtractedEntry ──
  let counter = 1;
  for (const m of rawMatches) {
    entries.push({
      file: filePath,
      relPath,
      originalKey: `${basePath}.${counter}`,
      text: m.text,
      range: m.range,
      callSiteType,
      framework,
      isString: m.isString,
    });
    counter++;
  }

  return entries;
}

/**
 * 从 Angular HTML 模板或包含 @Component 内联模板的 TypeScript 文件中
 * 提取硬编码的中文文本。
 *
 * @param filePath  文件绝对路径
 * @param relPath   相对于项目根目录的相对路径
 * @param content   文件的文本内容
 * @returns         ExtractedEntry 数组
 */
export function extractAngular(
  filePath: string,
  relPath: string,
  content: string,
): ExtractedEntry[] {
  const ext = relPath.split('.').pop()?.toLowerCase();

  // ── .html 文件：直接解析 HTML 模板 ──
  if (ext === 'html') {
    return parseTemplateAndExtract(
      content,
      filePath,
      relPath,
      'angular-html',
    );
  }

  // ── .ts 文件：从 @Component 装饰器中提取内联模板 ──
  if (ext === 'ts' || ext === 'tsx') {
    const inlineTemplates = extractInlineTemplatesFromTS(content);
    const entries: ExtractedEntry[] = [];

    for (const tpl of inlineTemplates) {
      const tplEntries = parseTemplateAndExtract(
        tpl.template,
        filePath,
        relPath,
        'angular-inline',
      );

      // 调整 range 偏移量：模板 AST 的偏移量是相对于模板字符串自身的，
      // 需要加上模板在 .ts 文件中的起始偏移量
      for (const entry of tplEntries) {
        entry.range = [
          entry.range[0] + tpl.startOffset,
          entry.range[1] + tpl.startOffset,
        ];
      }

      entries.push(...tplEntries);
    }

    return entries;
  }

  // ── 其他文件类型：不支持 ──
  return [];
}
