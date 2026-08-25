/**
 * LLM keyer — calls an OpenAI-compatible API to generate semantic key names.
 *
 * Features:
 *  - Batches entries to stay within context limits (default 100/batch)
 *  - Caches results to `.sultana/keymap.json` to avoid redundant API calls
 *  - Falls back to deterministic keys on error or missing credentials
 */
import { SemanticKeyer } from './types';
declare function hasCredentials(): boolean;
export declare function splitBatches<T>(items: T[], batchSize: number): T[][];
export interface LlmKeyerOptions {
    projectRoot: string;
    batchSize?: number;
    model?: string;
}
export declare class LlmKeyer implements SemanticKeyer {
    private projectRoot;
    private batchSize;
    private model;
    constructor(opts: LlmKeyerOptions);
    /** Exposed for testing: whether credentials exist. */
    static hasCredentials: typeof hasCredentials;
    /**
     * Map old keys to semantic keys via LLM.
     * Reads from cache first; calls LLM in batches for misses; saves cache.
     */
    mapKeys(entries: Array<{
        oldKey: string;
        text: string;
    }>): Promise<Map<string, string>>;
}
export {};
