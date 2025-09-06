"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Defines all log levels supported by the logger.
 */
var LogLevel;
(function (LogLevel) {
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
    LogLevel["DEBUG"] = "DEBUG";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
// Path to save logs
const logFilePath = path_1.default.join(process.cwd(), 'logs', 'app.log');
// Ensure logs directory exists
if (!fs_1.default.existsSync(path_1.default.dirname(logFilePath))) {
    fs_1.default.mkdirSync(path_1.default.dirname(logFilePath), { recursive: true });
}
const levels = {
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    DEBUG: 'DEBUG'
};
/**
 * Writes a log message to the console and log file.
 * @param {string} level - Log level (INFO, WARN, ERROR, DEBUG)
 * @param {string} message - Message to log
 */
function log(level, message) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level}] ${message}`;
    // Print to console
    switch (level) {
        case levels.ERROR:
            console.error(formattedMessage);
            break;
        case levels.WARN:
            console.warn(formattedMessage);
            break;
        case levels.DEBUG:
            console.debug(formattedMessage);
            break;
        default:
            console.log(formattedMessage);
    }
    // Append to file
    fs_1.default.appendFileSync(logFilePath, formattedMessage + '\n', 'utf8');
}
const logger = {
    info: (msg) => log(LogLevel.INFO, msg),
    warn: (msg) => log(LogLevel.WARN, msg),
    error: (msg) => log(LogLevel.ERROR, msg),
    debug: (msg) => log(LogLevel.DEBUG, msg)
};
exports.default = logger;
