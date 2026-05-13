import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchUserRole, type UserRole } from "@/lib/role";

export function useRole() {
  const { user, hydrated } = useAuth();
  const [role, setRole] = useState<UserRole>("user");
  const [roleHydrated, setRoleHydrated] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      setRole("user");
      setRoleHydrated(true);
      return;
    }
    fetchUserRole().then((r) => {
      setRole(r);
      setRoleHydrated(true);
    });
  }, [user, hydrated]);

  return { role, roleHydrated, isAdmin: role === "admin" };
}
