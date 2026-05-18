export type TelemetryMetadata = Record<string, unknown>;

const REDACTED = "[redacted]";
const REDACTED_NUMBER = "[redacted-number]";

const PII_KEY_PATTERN =
  /email|address|postcode|listing_?url|full_?name|project_?name|file(name)?|path|photo_?(url|name)|notes?|title/i;
const SENSITIVE_FINANCIAL_KEY_PATTERN =
  /purchase|gdv|budget|cost|profit|yield|roi|rent|price|subtotal|labou?r|materials|vat|contingency|total|amount|value/i;
const SAFE_NUMERIC_KEY_PATTERN = /duration|latency|count|pages|weeks|months|attempt|size|timeout/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function sanitizeFreeformString(value: string): string {
  const withoutEmail = value.replace(EMAIL_PATTERN, REDACTED);
  return withoutEmail.length > 180 ? `${withoutEmail.slice(0, 177)}...` : withoutEmail;
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (value == null || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (SENSITIVE_FINANCIAL_KEY_PATTERN.test(key) && !SAFE_NUMERIC_KEY_PATTERN.test(key)) {
      return REDACTED_NUMBER;
    }
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === "string") {
    if (PII_KEY_PATTERN.test(key) || SENSITIVE_FINANCIAL_KEY_PATTERN.test(key)) {
      return REDACTED;
    }
    return sanitizeFreeformString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(key, item));
  }

  if (isPlainObject(value)) {
    return sanitizeTelemetryMetadata(value);
  }

  return String(value);
}

export function sanitizeTelemetryMetadata(
  metadata?: Record<string, unknown>,
): TelemetryMetadata | undefined {
  if (!metadata) return undefined;

  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [key, sanitizeValue(key, value)]),
  );
}

export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeFreeformString(error.message || error.name || "Unknown error");
  }

  return sanitizeFreeformString(String(error));
}

export function sanitizeIdentifier(identifier: string | null | undefined): string | undefined {
  if (!identifier) return undefined;
  return identifier.length <= 12 ? identifier : `${identifier.slice(0, 8)}…`;
}
