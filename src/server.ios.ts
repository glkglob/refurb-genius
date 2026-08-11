/**
 * iOS Capacitor SPA-shell server entry (IOS-READINESS-2A).
 *
 * Used only by `vite.ios.config.ts` during the secretless SPA prerender that
 * emits `dist/ios/client/index.html`. Intentionally does NOT load Production
 * `src/server.ts` (Sentry/PostHog bootstrap, validateServerEnv / OPENAI_API_KEY).
 *
 * Production web continues to use `src/server.ts` via vite.config.ts /
 * vite.vercel.config.ts — this file must not change those semantics.
 */
export { default } from "@tanstack/react-start/server-entry";
