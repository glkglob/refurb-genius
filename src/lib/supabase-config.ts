// Quick env-availability check so the UI can render a setup message
// instead of crashing when Lovable Cloud is not connected.
type ImportMetaEnv = { env?: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_PUBLISHABLE_KEY?: string } };
export function isSupabaseConfigured(): boolean {
  try {
    const meta = import.meta as unknown as ImportMetaEnv;
    const url =
      meta.env?.VITE_SUPABASE_URL ||
      (typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined);
    const key =
      meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
      (typeof process !== "undefined" ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined);
    return Boolean(url && key);
  } catch {
    return false;
  }
}
