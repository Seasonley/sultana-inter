/**
 * Language short-code → FLORES-200 code mapping.
 * Covers 40+ common languages. Unknown codes can be passed raw via --model-code.
 */
/**
 * Resolve a human-friendly short code (e.g. 'zh') to a FLORES-200 code.
 * Returns the input unchanged if it's already a valid FLORES code or unknown.
 */
export declare function toFlores(code: string): string;
/**
 * Get the default output extension for i18n init file.
 */
export declare function getInitExt(framework: string): string;
