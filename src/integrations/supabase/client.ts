import { createBrowserSupabase } from "@repo/supabase/browser";
import type { Database } from "./types";

const isDev = import.meta.env.DEV;

// @deprecated — Import from the service boundary instead:
// import { supabase } from "@/platform/supabase/browser";
export const supabase = createBrowserSupabase<Database>({
  cookieName: "pip-auth",
  cookieDomain: isDev ? undefined : ".refurbgenius.info",
  secure: !isDev,
});
