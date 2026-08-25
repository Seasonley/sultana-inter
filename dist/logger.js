"use strict";
/**
 * NDJSON structured logger.
 *
 * - stdout: machine-readable NDJSON lines (one per pipeline event)
 * - stderr: human-readable progress messages
 * - Optional file mirror via --log-file
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const fs = __importStar(require("fs"));
class Logger {
    constructor() {
        this.logFd = null;
    }
    /** Open optional file mirror. */
    open(filePath) {
        if (filePath) {
            this.logFd = fs.openSync(filePath, 'a');
        }
    }
    /** Close file mirror. */
    close() {
        if (this.logFd !== null) {
            fs.closeSync(this.logFd);
            this.logFd = null;
        }
    }
    /** Emit an NDJSON line to stdout (and optional file). */
    ndjson(entry) {
        const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
        process.stdout.write(line + '\n');
        if (this.logFd !== null) {
            fs.writeSync(this.logFd, line + '\n');
        }
    }
    /** Emit a human-readable message to stderr. */
    progress(msg) {
        process.stderr.write(msg + '\n');
    }
    /** Convenience: info/warn/error to stderr + NDJSON. */
    log(level, stage, msg, extra) {
        const prefix = level === 'error' ? '✖' : level === 'warn' ? '⚠' : '✔';
        this.progress(`${prefix} [${stage}] ${msg}`);
        this.ndjson({ stage, event: level, msg, ...extra });
    }
}
/** Singleton logger instance. */
exports.logger = new Logger();
//# sourceMappingURL=logger.js.map