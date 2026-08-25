/**
 * NDJSON structured logger.
 *
 * - stdout: machine-readable NDJSON lines (one per pipeline event)
 * - stderr: human-readable progress messages
 * - Optional file mirror via --log-file
 */

import * as fs from 'fs';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  stage: string;
  event?: string;
  [key: string]: unknown;
}

class Logger {
  private logFd: number | null = null;

  /** Open optional file mirror. */
  open(filePath?: string): void {
    if (filePath) {
      this.logFd = fs.openSync(filePath, 'a');
    }
  }

  /** Close file mirror. */
  close(): void {
    if (this.logFd !== null) {
      fs.closeSync(this.logFd);
      this.logFd = null;
    }
  }

  /** Emit an NDJSON line to stdout (and optional file). */
  ndjson(entry: LogEntry): void {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
    process.stdout.write(line + '\n');
    if (this.logFd !== null) {
      fs.writeSync(this.logFd, line + '\n');
    }
  }

  /** Emit a human-readable message to stderr. */
  progress(msg: string): void {
    process.stderr.write(msg + '\n');
  }

  /** Convenience: info/warn/error to stderr + NDJSON. */
  log(level: LogLevel, stage: string, msg: string, extra?: Record<string, unknown>): void {
    const prefix = level === 'error' ? '✖' : level === 'warn' ? '⚠' : '✔';
    this.progress(`${prefix} [${stage}] ${msg}`);
    this.ndjson({ stage, event: level, msg, ...extra });
  }
}

/** Singleton logger instance. */
export const logger = new Logger();
