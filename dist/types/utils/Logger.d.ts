/**
 * Defines all log levels supported by the logger.
 */
export declare enum LogLevel {
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR",
    DEBUG = "DEBUG"
}
/**
 * Represents a single log entry
 */
export interface LogEntry {
    level: LogLevel;
    message: string;
}
/**
 * Logger interface that defines the public methods.
 */
export interface Logger {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    debug(message: string): void;
}
declare const logger: Logger;
export default logger;
