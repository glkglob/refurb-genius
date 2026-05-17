// Lightweight structured logging for production diagnostics.
//
// Provides logger.info/warn/error with optional metadata.
// Console-backed (no external dependencies).
// Safe for SSR — disabled in server context.
//
// All errors are captured to Sentry separately; this logger
// provides visibility into non-error diagnostics.

type LogMetadata = Record<string, unknown>;

type LogLevel = "info" | "warn" | "error";

function formatLog(level: LogLevel, message: string, metadata?: LogMetadata): string {
  const timestamp = new Date().toISOString();
  const meta = metadata ? ` ${JSON.stringify(metadata)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${meta}`;
}

function shouldLog(level: LogLevel): boolean {
  // Errors always logged in production.
  if (level === "error") return true;

  // Info/warn suppressed in production (spam prevention).
  // If you need to see info logs, set ?debug=1 in URL.
  if (typeof window !== "undefined") {
    const debug = new URL(window.location.href).searchParams.has("debug");
    return debug || !import.meta.env.PROD;
  }

  // SSR: never log to avoid cluttering server output.
  return false;
}

export const logger = {
  info(message: string, metadata?: LogMetadata): void {
    if (shouldLog("info")) {
      console.log(formatLog("info", message, metadata));
    }
  },

  warn(message: string, metadata?: LogMetadata): void {
    if (shouldLog("warn")) {
      console.warn(formatLog("warn", message, metadata));
    }
  },

  error(message: string, metadata?: LogMetadata): void {
    if (shouldLog("error")) {
      console.error(formatLog("error", message, metadata));
    }
  },
};
