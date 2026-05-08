// Quick env-availability check so the UI can render a setup message
// instead of crashing when Lovable Cloud is not connected.
export function isSupabaseConfigured(): boolean {
  try {
    const url =
      (import.meta as any).env?.VITE_SUPABASE_URL ||
      (typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined);
    const key =
      (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
      (typeof process !== "undefined" ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined);
    return Boolean(url && key);
  } catch {
    return false;
  }
}
