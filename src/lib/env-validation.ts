/**
 * Environment variable validation for production readiness and security.
 * Call early in server startup or critical paths.
 */

export function validateServerEnv(): void {
  const required = ["OPENAI_API_KEY"]; // Supabase handled by @repo/supabase
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0 && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required server env vars: ${missing.join(", ")}`);
  }
}

// Client-side (Vite) validation - safe vars only
export function validateClientEnv(): void {
  // Add VITE_ checks if needed (e.g. PostHog optional)
  if (import.meta.env.PROD) {
    // e.g. warn if no analytics key
  }
}
