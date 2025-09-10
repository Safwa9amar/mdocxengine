import fs from "fs";
import path from "path";

/**
 * Defines all log levels supported by the logger.
 */
export enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  DEBUG = "DEBUG",
}

/**
 * Configuration for the logger service.
 */
export interface LoggerConfig {
  logLevel: LogLevel;
  logToFile: boolean;
  logFilePath?: string;
}

/**
 * A service for logging messages to the console and a file.
 */
export class LoggerService {
  private config: LoggerConfig;

  constructor() {
    // Default configuration
    this.config = {
      logLevel: LogLevel.INFO,
      logToFile: true,
      logFilePath: path.join(process.cwd(), "logs", "app.log"),
    };

    // Ensure logs directory exists on initialization
    if (this.config.logToFile && this.config.logFilePath) {
      this.ensureLogDirectoryExists(this.config.logFilePath);
    }
  }

  /**
   * Configures the logger settings.
   * @param config The logger configuration.
   */
  public configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.config.logToFile && this.config.logFilePath) {
      this.ensureLogDirectoryExists(this.config.logFilePath);
    }
  }

  /**
   * Logs a message with a specific log level.
   * @param level The log level.
   * @param message The message to log.
   * @param stringify Whether to stringify the message (e.g., an object).
   */
  private log(level: LogLevel, message: any, stringify: boolean = false): void {
    const logLevels = Object.keys(LogLevel);
    const minLevelIndex = logLevels.indexOf(this.config.logLevel);
    const currentLevelIndex = logLevels.indexOf(level);

    // Check if the current log level is high enough to be logged
    if (currentLevelIndex < minLevelIndex) {
      return;
    }

    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level}] ${stringify ? JSON.stringify(message) : message}`;

    // Log to console
    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }

    // Append to file asynchronously
    if (this.config.logToFile && this.config.logFilePath) {
      fs.appendFile(this.config.logFilePath, formattedMessage + "\n", "utf8", (err) => {
        if (err) {
          console.error("Failed to write to log file:", err);
        }
      });
    }
  }

  public info(message: any, stringify: boolean = false): void {
    this.log(LogLevel.INFO, message, stringify);
  }

  public warn(message: any, stringify: boolean = false): void {
    this.log(LogLevel.WARN, message, stringify);
  }

  public error(message: any, stringify: boolean = false): void {
    this.log(LogLevel.ERROR, message, stringify);
  }

  public debug(message: any, stringify: boolean = false): void {
    this.log(LogLevel.DEBUG, message, stringify);
  }

  /**
   * Helper function to ensure the log directory exists.
   * @param filePath The path to the log file.
   */
  private ensureLogDirectoryExists(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// Export a singleton instance of the logger for convenience
const logger = new LoggerService();
export default logger;
