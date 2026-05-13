import { supabase } from "@/integrations/supabase/client";

export type UserRole = "user" | "admin";

type ProfileRoleRow = {
  role: UserRole | null;
};

export async function fetchUserRole(): Promise<UserRole> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return "user";
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<ProfileRoleRow>();

  if (error || !data?.role) {
    return "user";
  }

  return data.role;
}
