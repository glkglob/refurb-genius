import { createStart, createMiddleware, createCsrfMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { logger } from "./lib/logger";
import { validateClientEnv } from "./lib/env-validation";

// Side-effect import: ensures Sentry.init() runs as early as possible
// in the client bundle (guarded inside the module).
import "@/lib/sentry";

// Client env validation (runs in browser bundle)
if (typeof window !== "undefined") {
  try {
    validateClientEnv();
  } catch (e) {
    logger.warn("[env] Client env validation warning", { error: String(e) });
  }
}

/**
 * TanStack Start CSRF protection for server functions.
 *
 * Custom `src/start.ts` disables automatic CSRF middleware installation.
 * Restore the framework default: same-origin only, serverFn handlers only.
 * Keep defaults strict — no origin widening, no missing-metadata bypass,
 * no mobile WebView exceptions.
 *
 * Must run before errorMiddleware so CSRF rejections short-circuit as 403
 * without being reclassified as uncaught 500s.
 */
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    // Dynamic import keeps @sentry/node out of the shared Start client graph.
    try {
      const { captureServerException } = await import("@/platform/sentry/server-capture");
      captureServerException(error, { source: "start-middleware" });
    } catch {
      // Capture must never block branded error response
    }
    logger.error("Start middleware uncaught error", {
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, errorMiddleware],
}));
