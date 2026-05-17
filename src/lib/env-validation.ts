// Production environment validation and diagnostics.
//
// Validates required environment variables at startup and provides
// operational health checks for debugging and support.

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// Validate environment at startup (browser only, safe for SSR)
export function validateEnvironment(): void {
  if (typeof window === "undefined") return; // SSR context, skip validation

  // Required in all environments
  const requiredVars = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };

  // Required only in production
  if (isProduction) {
    Object.assign(requiredVars, {
      VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
    });
  }

  // Validate presence
  const missing = Object.entries(requiredVars)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    const msg = `Missing required environment variables: ${missing.join(", ")}`;
    if (isProduction) {
      console.error("🚨 PRODUCTION ENV ERROR:", msg);
      // In production, these are critical
      throw new Error(msg);
    } else {
      console.warn("⚠️ DEV ENV WARNING:", msg);
      // In development, warn but don't fail
    }
  }

  // Validate format (basic checks)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  if (supabaseUrl && typeof supabaseUrl === "string" && !supabaseUrl.startsWith("https://")) {
    const msg = "VITE_SUPABASE_URL must be HTTPS";
    console.warn("⚠️ ENV FORMAT WARNING:", msg);
  }

  if (isProduction) {
    const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string;
    if (!sentryDsn?.startsWith("https://")) {
      const msg = "VITE_SENTRY_DSN must be HTTPS";
      console.warn("⚠️ ENV FORMAT WARNING:", msg);
    }
  }
}

// Production health diagnostics for support/debugging
export interface HealthDiagnostics {
  buildVersion: string;
  environment: "development" | "production" | "staging";
  sentryEnabled: boolean;
  supabaseConnected: boolean | null;
  featureFlags: Record<string, boolean>;
  timestamp: string;
}

export async function getHealthDiagnostics(): Promise<HealthDiagnostics> {
  // Build version from package.json (embedded at build time)
  const buildVersion = import.meta.env.VITE_BUILD_VERSION || "unknown";

  // Environment classification
  const environment = isProduction ? "production" : isDevelopment ? "development" : "staging";

  // Sentry status
  const sentryEnabled = Boolean(import.meta.env.VITE_SENTRY_DSN);

  // Try to test Supabase connectivity (safe, non-blocking)
  let supabaseConnected: boolean | null = null;
  if (typeof window !== "undefined") {
    try {
      // Ping Supabase auth endpoint (lightweight check)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`, {
        method: "GET",
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeoutId);
      supabaseConnected = response?.ok ?? false;
    } catch {
      // Network error, can't determine
      supabaseConnected = null;
    }
  }

  // Feature flags (see feature-flags.ts)
  const featureFlags = getFeatureFlags();

  return {
    buildVersion,
    environment,
    sentryEnabled,
    supabaseConnected,
    featureFlags,
    timestamp: new Date().toISOString(),
  };
}

// Log diagnostics to console (for support debugging)
export async function logHealthDiagnostics(): Promise<void> {
  const diag = await getHealthDiagnostics();
  console.group("🏥 Refurb Genius Health Diagnostics");
  console.log("Build Version:", diag.buildVersion);
  console.log("Environment:", diag.environment);
  console.log("Sentry:", diag.sentryEnabled ? "✅ Enabled" : "⚠️ Disabled");
  console.log(
    "Supabase:",
    diag.supabaseConnected === null ? "?" : diag.supabaseConnected ? "✅" : "❌",
  );
  console.log("Features:", diag.featureFlags);
  console.log("Time:", diag.timestamp);
  console.groupEnd();
}

// Get just feature flags (imported by getHealthDiagnostics)
function getFeatureFlags(): Record<string, boolean> {
  return {
    pdfExport: true, // Always enabled
    aiAnalysis: Boolean(import.meta.env.VITE_OPENAI_API_KEY),
    betaFeatures: isDevelopment || import.meta.env.VITE_ENABLE_BETA_FEATURES === "true",
  };
}

// Expose diagnostics globally for support (window.appDiag in console)
if (typeof window !== "undefined" && isDevelopment) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).appDiag = { validateEnvironment, getHealthDiagnostics, logHealthDiagnostics };
}
