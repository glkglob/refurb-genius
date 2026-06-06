// Singleton browser Supabase client — no app-level imports.
//
// This file intentionally has no imports from @/lib/* or @/services/*
// so that it can be safely imported by auth.ts without ever creating
// a circular dependency, regardless of what the barrel (index.ts)
// re-exports in the future.
//
// Import this directly when you need the bare client in a module that
// is itself re-exported by @/services/supabase:
//   import { supabase } from "@/services/supabase/_client";
//
// All other code should use the barrel:
//   import { supabase } from "@/services/supabase";
import type { Database } from "@repo/supabase";
import { createBrowserSupabase } from "@repo/supabase/browser";

const isDev = import.meta.env.DEV;

// Only pin the cookie domain when running on the production hostname.
// Preview deployments (*.vercel.app) and localhost must not have a
// domain attribute or the cookie will be silently rejected.
const hostname = typeof window !== "undefined" ? window.location.hostname : "";
const isProdHostname =
  hostname === "refurbgenius.info" || hostname.endsWith(".refurbgenius.info");

export const supabase = createBrowserSupabase<Database>({
  cookieName: "pip-auth",
  cookieDomain: !isDev && isProdHostname ? ".refurbgenius.info" : undefined,
  secure: !isDev,
});
