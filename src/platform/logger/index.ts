import { logger } from "@/lib/logger";

export interface PlatformLogger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

export const createLogger = (): PlatformLogger => ({
  debug: logger.debug,
  info: logger.info,
  warn: logger.warn,
  error: logger.error,
});
