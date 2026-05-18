import { addDiagnosticBreadcrumb } from "./sentry";
import { logger } from "./logger";
import { sanitizeTelemetryMetadata, type TelemetryMetadata } from "./telemetry";

export type MetricName =
  | "pricing_engine_duration_ms"
  | "report_generation_duration_ms"
  | "report_export_duration_ms"
  | "api_latency_ms"
  | "supabase_query_duration_ms";

export type MetricEntry = {
  name: MetricName;
  value: number;
  timestamp: string;
  context?: TelemetryMetadata;
};

declare global {
  interface Window {
    __REFURB_GENIUS_METRICS__?: MetricEntry[];
  }
}

const MAX_BUFFER_SIZE = 50;

function now(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function shouldCaptureBreadcrumb(name: MetricName, value: number): boolean {
  return (
    name === "pricing_engine_duration_ms" ||
    name === "report_generation_duration_ms" ||
    value >= 1_000
  );
}

function bufferMetric(entry: MetricEntry): void {
  if (typeof window === "undefined") return;

  const buffer = window.__REFURB_GENIUS_METRICS__ ?? [];
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER_SIZE) {
    buffer.splice(0, buffer.length - MAX_BUFFER_SIZE);
  }
  window.__REFURB_GENIUS_METRICS__ = buffer;
  window.dispatchEvent(new CustomEvent("refurb-genius:metric", { detail: entry }));
}

export function recordMetric(name: MetricName, value: number, context?: TelemetryMetadata): void {
  const entry: MetricEntry = {
    name,
    value: Math.round(value),
    timestamp: new Date().toISOString(),
    context: sanitizeTelemetryMetadata(context),
  };

  bufferMetric(entry);

  if (shouldCaptureBreadcrumb(entry.name, entry.value)) {
    addDiagnosticBreadcrumb(`metric:${entry.name}`, {
      ...entry.context,
      value: entry.value,
      unit: "ms",
    });
  }

  if (!import.meta.env.PROD) {
    logger.info(`[metric] ${entry.name}`, { ...entry.context, value: entry.value, unit: "ms" });
  }
}

export function measureSync<T>(name: MetricName, work: () => T, context?: TelemetryMetadata): T {
  const startedAt = now();
  try {
    return work();
  } finally {
    recordMetric(name, now() - startedAt, context);
  }
}

export async function measureAsync<T>(
  name: MetricName,
  work: () => Promise<T>,
  context?: TelemetryMetadata,
): Promise<T> {
  const startedAt = now();
  try {
    return await work();
  } finally {
    recordMetric(name, now() - startedAt, context);
  }
}
