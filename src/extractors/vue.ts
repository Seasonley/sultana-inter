/**
 * Vue SFC (Single File Component) Chinese text extractor.
 * Ported from ev-i18n's Babel AST + Vue SFC parsing logic.
 */

import { ExtractedEntry, CallSiteType, Framework } from '../types';
import { logger } from '../logger';
import * as parser from '@babel/parser';
import * as traverse from '@babel/traverse';
import * as t from '@babel/types';
import { parse as vueParse } from '@vue/compiler-sfc';
import { parse as vueTemplateParse } from '@vue/compiler-dom';

/**
 * Check if a string contains Chinese characters.
 */
function containsChinese(str: string): boolean {
  return /[\u4e00-\u9fa5]/.test(str);
}

/**
 * Generate key prefix from relative file path.
 */
function getKeyPrefix(filePath: string, rootPath?: string): string {
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
function extractFromTemplate(
  templateContent: string,
  templateStart: number,
  relPath: string,
  filePath: string,
  counter: { value: number }
): ExtractedEntry[] {
  const entries: ExtractedEntry[] = [];

  // Parse template content with location information
  const templateAst = vueTemplateParse(templateContent, {
    comments: true,
    parseMode: 'html',
    whitespace: 'condense',
    nodeTransforms: [],
  } as any);

  // Recursively walk nodes
  function walkNode(node: any): void {
    if (!node) return;

    // Handle text nodes (type 2)
    if (node.type === 2 && typeof node.content === 'string') {
      const text = node.content.trim();
      if (!text) return;
      
      // Skip pure interpolation nodes (type 5)
      if (/^{{\s*[^}]*\s*}}$/.test(text)) return;
      
      if (containsChinese(text)) {
        // Find position in original template content
        const nodeStart = node.loc.start.offset;
        const nodeEnd = node.loc.end.offset;
        const absoluteStart = templateStart + nodeStart;
        const absoluteEnd = templateStart + nodeEnd;

        // Split text on interpolation boundaries
        const segments: Array<{ type: 'text' | 'interpolation'; content: string; start: number }> = [];
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
function extractFromScript(
  scriptContent: string,
  scriptStart: number,
  relPath: string,
  filePath: string,
  counter: { value: number }
): ExtractedEntry[] {
  const entries: ExtractedEntry[] = [];

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
        if (
          t.isImportDeclaration(parent) ||
          (t.isCallExpression(parent) &&
            t.isIdentifier(parent.callee) &&
            (parent.callee.name === 'require' || parent.callee.name === 'import'))
        ) {
          return;
        }

        // Skip existing i18n calls like $t(), t(), $t()
        if (
          t.isCallExpression(parent) &&
          t.isMemberExpression(parent.callee) &&
          t.isIdentifier(parent.callee.property) &&
          (parent.callee.property.name === 't' || parent.callee.property.name === '$t')
        ) {
          return;
        }

        // Get source location
        const start = node.start!;
        const end = node.end!;

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

        const start = node.start!;
        const end = node.end!;

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
            expr: scriptContent.substring(expr.start!, expr.end!),
          })),
        });
      },
    });
  } catch (error) {
    logger.log('error', 'vue-script-parse', `Failed to parse script in ${relPath}: ${error}`);
  }

  return entries;
}

/**
 * Extract hardcoded Chinese text from a Vue SFC file.
 */
export function extractVue(
  filePath: string,
  relPath: string,
  content: string
): ExtractedEntry[] {
  const entries: ExtractedEntry[] = [];
  const counter = { value: 0 };

  try {
    // Parse Vue SFC
    const { descriptor, errors } = vueParse(content);

    if (errors.length > 0) {
      logger.log('warn', 'vue-parse', `Parse warnings for ${relPath}`, {
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
          const templateEntries = extractFromTemplate(
            templateContent,
            contentStart,
            relPath,
            filePath,
            counter
          );
          entries.push(...templateEntries);
        }
      }
    }

    // Process script blocks
    const scriptBlocks = [
      descriptor.script,
      descriptor.scriptSetup,
    ].filter(Boolean) as Array<{ content: string; lang?: string; setup?: boolean }>;

    for (const script of scriptBlocks) {
      // Calculate script start position in original content
      const scriptTag = script.setup ? 'script setup' : 'script';
      const scriptStart = content.indexOf(`<${scriptTag}`);
      if (scriptStart !== -1) {
        const tagEnd = content.indexOf('>', scriptStart);
        if (tagEnd !== -1) {
          const contentStart = tagEnd + 1;
          const scriptEntries = extractFromScript(
            script.content,
            contentStart,
            relPath,
            filePath,
            counter
          );
          entries.push(...scriptEntries);
        }
      }
    }
  } catch (error) {
    logger.log('error', 'vue-extract', `Failed to extract from ${relPath}: ${error}`);
  }

  return entries;
}