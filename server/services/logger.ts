import { storage } from "../storage";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogSource = "scheduler" | "agent" | "executor" | "data_collector" | "api" | "system" | "websocket" | "alerts";

interface LogOptions {
  source: LogSource;
  metadata?: Record<string, unknown>;
}

class Logger {
  private async log(level: LogLevel, message: string, options: LogOptions) {
    const { source, metadata } = options;

    // Console output
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${source}]`;
    
    switch (level) {
      case "error":
        console.error(`${prefix} ${message}`, metadata || "");
        break;
      case "warn":
        console.warn(`${prefix} ${message}`, metadata || "");
        break;
      case "debug":
        console.debug(`${prefix} ${message}`, metadata || "");
        break;
      default:
        console.log(`${prefix} ${message}`, metadata || "");
    }

    // Database logging for non-debug levels
    if (level !== "debug") {
      try {
        await storage.createLog({
          level,
          source,
          message,
          metadata: metadata || null,
        });
      } catch (err) {
        console.error("Failed to write log to database:", err);
      }
    }
  }

  debug(message: string, options: LogOptions) {
    return this.log("debug", message, options);
  }

  info(message: string, options: LogOptions) {
    return this.log("info", message, options);
  }

  warn(message: string, options: LogOptions) {
    return this.log("warn", message, options);
  }

  error(message: string, options: LogOptions) {
    return this.log("error", message, options);
  }
}

export const logger = new Logger();
