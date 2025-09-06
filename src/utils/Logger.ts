import fs from 'fs';
import path from 'path';
/**
 * Defines all log levels supported by the logger.
 */
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
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

// Path to save logs
const logFilePath = path.join(process.cwd(), 'logs', 'app.log');

// Ensure logs directory exists
if (!fs.existsSync(path.dirname(logFilePath))) {
  fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
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
function log(level : LogLevel, message : string) {
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
  fs.appendFileSync(logFilePath, formattedMessage + '\n', 'utf8');
}



 const  logger : Logger = {
  info: (msg) => log(LogLevel.INFO, msg),
  warn: (msg) => log(LogLevel.WARN, msg),
  error: (msg) => log(LogLevel.ERROR, msg),
  debug: (msg) => log(LogLevel.DEBUG, msg)
};

export default logger