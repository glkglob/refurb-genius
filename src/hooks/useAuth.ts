import { useEffect, useState } from "react";
import { auth, type AuthUser } from "@/lib/auth";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => auth.getUser());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setUser(auth.getUser());
    setHydrated(true);
    const off = auth.onChange(setUser);
    return () => off();
  }, []);

  return { user, hydrated, isAuthenticated: !!user };
}
