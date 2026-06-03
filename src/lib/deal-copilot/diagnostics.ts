import { formatGBP } from "@/lib/utils";

/**
 * Structured logging for Deal Copilot Lite
 *
 * Provides consistent, categorized logging for:
 * - Analysis completeness
 * - Validation failures
 * - Save failures
 * - Render edge cases
 *
 * Logs are categorized for operational filtering and support.
 */

import { logger } from "@/lib/logger";

export type DiagnosticLevel = "debug" | "info" | "warn" | "error";
export type DiagnosticCategory = "validation" | "analysis" | "save" | "render" | "calculation";

export interface DiagnosticEvent {
  level: DiagnosticLevel;
  category: DiagnosticCategory;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Log structured diagnostic event
 */
function logEvent(event: DiagnosticEvent): void {
  const msg = `[deal-copilot/${event.category}] ${event.message}`;
  const ctx = event.context || undefined;

  switch (event.level) {
    case "debug":
      logger.debug(msg, ctx);
      break;
    case "info":
      logger.info(msg, ctx);
      break;
    case "warn":
      logger.warn(msg, ctx);
      break;
    case "error":
      logger.error(msg, ctx);
      break;
  }
}

/**
 * Diagnostics namespace for Deal Copilot
 */
export const dealCopilotDiagnostics = {
  /**
   * Log validation failure
   */
  validationFailed(fields: string[]): void {
    logEvent({
      level: "info",
      category: "validation",
      message: "Form validation incomplete",
      context: { missingFields: fields, count: fields.length },
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log successful analysis completion
   */
  analysisComplete(metrics: {
    roi: number;
    profit: number;
    score: number;
    recommendation: string;
  }): void {
    logEvent({
      level: "info",
      category: "analysis",
      message: "Deal analysis complete",
      context: metrics,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log analysis failure (incomplete input)
   */
  analysisFailed(reason: string): void {
    logEvent({
      level: "warn",
      category: "analysis",
      message: "Deal analysis incomplete",
      context: { reason },
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log save success
   */
  saveSUCCESS(opportunityId: string, title: string): void {
    logEvent({
      level: "info",
      category: "save",
      message: "Opportunity saved successfully",
      context: { opportunityId, title },
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log save failure
   */
  saveError(error: Error | string, title?: string): void {
    const message = error instanceof Error ? error.message : error;
    logEvent({
      level: "error",
      category: "save",
      message: "Opportunity save failed",
      context: { error: message, title },
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log duplicate save prevention
   */
  saveDuplicate(): void {
    logEvent({
      level: "debug",
      category: "save",
      message: "Save skipped: identical to previous opportunity",
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log concurrent save prevention
   */
  saveConcurrentBlock(): void {
    logEvent({
      level: "debug",
      category: "save",
      message: "Save blocked: already in progress",
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log render edge case
   */
  renderEdgeCase(issue: string, context?: Record<string, unknown>): void {
    logEvent({
      level: "warn",
      category: "render",
      message: issue,
      context,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log unexpected value in rendering
   */
  renderInvalidValue(field: string, value: unknown): void {
    logEvent({
      level: "error",
      category: "render",
      message: `Invalid value in render: ${field}`,
      context: { field, value, type: typeof value },
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log calculation anomaly
   */
  calculationAnomaly(metric: string, value: number, expected?: number): void {
    logEvent({
      level: "warn",
      category: "calculation",
      message: `Unexpected calculation result: ${metric}`,
      context: { metric, value, expected, drift: expected ? value - expected : undefined },
      timestamp: new Date().toISOString(),
    });
  },
};

/**
 * Safety wrapper for potentially unsafe number formatting
 */
export function safeFormatCurrency(value: unknown): string {
  if (value === null || value === undefined) {
    dealCopilotDiagnostics.renderInvalidValue("currency", value);
    return "—";
  }

  if (!Number.isFinite(value as number)) {
    dealCopilotDiagnostics.renderInvalidValue("currency", value);
    return "—";
  }

  try {
    return formatGBP(value as number);
  } catch (e) {
    dealCopilotDiagnostics.renderInvalidValue("currency", value);
    return "—";
  }
}

/**
 * Safety wrapper for percentage formatting
 */
export function safeFormatPercent(value: unknown): string {
  if (value === null || value === undefined) {
    dealCopilotDiagnostics.renderInvalidValue("percent", value);
    return "—";
  }

  if (!Number.isFinite(value as number)) {
    dealCopilotDiagnostics.renderInvalidValue("percent", value);
    return "—";
  }

  return `${(value as number).toFixed(1)}%`;
}
