import { supabase } from "@/integrations/supabase/client";

export type UserRole = "user" | "admin";

export async function fetchUserRole(): Promise<UserRole> {
  const { data, error } = await supabase.from("profiles").select("role").single();
  if (error || !data) return "user";
  return data.role === "admin" ? "admin" : "user";
}
