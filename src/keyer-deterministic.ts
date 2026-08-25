/**
 * Deterministic keyer — generates camelCase keys from English translation text.
 *
 * Implements SemanticKeyer so it can be swapped with LlmKeyer transparently.
 *
 * Key generation rules:
 *  1. Take the English translation text (e.g. "Hello World")
 *  2. Convert to camelCase valid JS identifier (e.g. "helloWorld")
 *  3. Deduplicate by appending numeric suffix (_2, _3, ...) if needed
 *  4. Fallback to path-based key if text is empty or all non-ASCII
 */

import { SemanticKeyer } from './types';

/**
 * Convert English text to a valid camelCase JS identifier.
 *
 * Examples:
 *   "Hello World"        → "helloWorld"
 *   "Welcome to the App" → "welcomeToTheApp"
 *   "User Login"         → "userLogin"
 *   "123abc"             → "abc123" (leading digits stripped)
 *   ""                   → ""
 */
export function toCamelCase(text: string): string {
  if (!text) return '';

  // Remove non-alphanumeric characters (keep spaces for word splitting)
  const cleaned = text.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  if (!cleaned) return '';

  // Split into words, filter empty
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return '';

  // Build camelCase: first word lowercase, rest capitalized
  let result = words[0].toLowerCase();
  for (let i = 1; i < words.length; i++) {
    result += words[i].charAt(0).toUpperCase() + words[i].slice(1).toLowerCase();
  }

  // Strip leading digits (invalid JS identifier start)
  result = result.replace(/^[0-9]+/, '');

  return result;
}

/**
 * Ensure the key is a valid JS identifier.
 * If empty or starts with digit after processing, prefix with "k".
 */
function ensureValidIdentifier(key: string): string {
  if (!key) return 'k';
  if (/^[0-9]/.test(key)) return 'k' + key;
  // Check for reserved words
  const reserved = new Set([
    'abstract', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class',
    'const', 'continue', 'debugger', 'default', 'delete', 'do', 'double',
    'else', 'enum', 'export', 'extends', 'final', 'finally', 'float', 'for',
    'function', 'goto', 'if', 'implements', 'import', 'in', 'instanceof',
    'int', 'interface', 'long', 'native', 'new', 'package', 'private',
    'protected', 'public', 'return', 'short', 'static', 'super', 'switch',
    'synchronized', 'this', 'throw', 'throws', 'transient', 'try', 'typeof',
    'var', 'void', 'volatile', 'while', 'with',
  ]);
  if (reserved.has(key)) return key + 'Key';
  return key;
}

export class DeterministicKeyer implements SemanticKeyer {
  /**
   * Generate camelCase keys from the `text` field (which contains the
   * English translation at this pipeline stage).
   *
   * Deduplicates by appending _2, _3, etc.
   */
  async mapKeys(
    entries: Array<{ oldKey: string; text: string }>
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const usedKeys = new Map<string, number>(); // key → count

    for (const entry of entries) {
      let camelKey = toCamelCase(entry.text);

      // Fallback: if camelCase generation produces empty string, use oldKey
      if (!camelKey) {
        camelKey = entry.oldKey.replace(/[^a-zA-Z0-9]/g, '');
        if (!camelKey) camelKey = 'key';
      }

      camelKey = ensureValidIdentifier(camelKey);

      // Deduplicate
      const count = usedKeys.get(camelKey) || 0;
      usedKeys.set(camelKey, count + 1);
      if (count > 0) {
        camelKey = `${camelKey}_${count + 1}`;
      }

      result.set(entry.oldKey, camelKey);
    }

    return result;
  }
}
