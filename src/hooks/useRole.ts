import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchUserRole, clearRoleCache, type UserRole } from "@/lib/role";

export function useRole() {
  const { user, hydrated } = useAuth();
  const [role, setRole] = useState<UserRole>("user");
  const [roleHydrated, setRoleHydrated] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      clearRoleCache();
      setRole("user");
      setRoleHydrated(true);
      return;
    }
    fetchUserRole().then((r) => {
      setRole(r);
      setRoleHydrated(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on user.id to avoid refetch on reference changes
  }, [user?.id, hydrated]);

  return { role, roleHydrated, isAdmin: role === "admin" };
}
