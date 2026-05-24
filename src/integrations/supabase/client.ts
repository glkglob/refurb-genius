import { createBrowserSupabase } from "@repo/supabase/browser";
import type { Database } from "./types";

const isDev = import.meta.env.DEV;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = createBrowserSupabase<Database>({
  cookieName: "pip-auth",
  cookieDomain: isDev ? undefined : ".refurbgenius.space",
  secure: !isDev,
});
