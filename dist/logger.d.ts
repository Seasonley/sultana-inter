/**
 * NDJSON structured logger.
 *
 * - stdout: machine-readable NDJSON lines (one per pipeline event)
 * - stderr: human-readable progress messages
 * - Optional file mirror via --log-file
 */
export type LogLevel = 'info' | 'warn' | 'error';
export interface LogEntry {
    stage: string;
    event?: string;
    [key: string]: unknown;
}
declare class Logger {
    private logFd;
    /** Open optional file mirror. */
    open(filePath?: string): void;
    /** Close file mirror. */
    close(): void;
    /** Emit an NDJSON line to stdout (and optional file). */
    ndjson(entry: LogEntry): void;
    /** Emit a human-readable message to stderr. */
    progress(msg: string): void;
    /** Convenience: info/warn/error to stderr + NDJSON. */
    log(level: LogLevel, stage: string, msg: string, extra?: Record<string, unknown>): void;
}
/** Singleton logger instance. */
export declare const logger: Logger;
export {};
