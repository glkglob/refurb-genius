import { addDiagnosticBreadcrumb, captureException } from "@/lib/sentry";

export interface SentryClient {
  captureException(error: unknown, context?: Record<string, unknown>): void;
  addBreadcrumb(message: string, metadata?: Record<string, unknown>): void;
}

export const createSentry = (): SentryClient => ({
  captureException,
  addBreadcrumb: addDiagnosticBreadcrumb,
});
