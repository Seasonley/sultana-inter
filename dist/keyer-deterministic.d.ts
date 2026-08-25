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
export declare function toCamelCase(text: string): string;
export declare class DeterministicKeyer implements SemanticKeyer {
    /**
     * Generate camelCase keys from the `text` field (which contains the
     * English translation at this pipeline stage).
     *
     * Deduplicates by appending _2, _3, etc.
     */
    mapKeys(entries: Array<{
        oldKey: string;
        text: string;
    }>): Promise<Map<string, string>>;
}
