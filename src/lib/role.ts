import { supabase } from "@/services/supabase";

export type UserRole = "user" | "admin";

type ProfileRoleRow = {
  role: UserRole | null;
};

let _cachedRole: UserRole | null = null;
let _cachedForUserId: string | null = null;
let _inflight: Promise<UserRole> | null = null;

export function clearRoleCache(): void {
  _cachedRole = null;
  _cachedForUserId = null;
  _inflight = null;
}

export async function fetchUserRole(): Promise<UserRole> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    clearRoleCache();
    return "user";
  }

  if (_cachedRole !== null && _cachedForUserId === user.id) {
    return _cachedRole;
  }

  if (_inflight && _cachedForUserId === user.id) {
    return _inflight;
  }

  _cachedForUserId = user.id;
  _inflight = Promise.resolve(
    supabase.from("profiles").select("role").eq("id", user.id).single<ProfileRoleRow>(),
  )
    .then(({ data, error }) => {
      const role: UserRole = error || !data?.role ? "user" : data.role;
      _cachedRole = role;
      _inflight = null;
      return role;
    })
    .catch(() => {
      _inflight = null;
      return "user" as UserRole;
    });

  return _inflight;
}
