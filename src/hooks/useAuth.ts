import { useEffect, useState } from "react";
import { auth, type AuthUser } from "@/lib/auth";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => auth.getUser());
  // Start hydrated only if the auth module already has the session resolved
  // (e.g., client-side navigation after initial load). Otherwise wait for
  // the first onChange callback which fires once the async session check
  // completes. This prevents guards from seeing hydrated=true,user=null
  // and redirecting before the real session is restored.
  const [hydrated, setHydrated] = useState(() => auth.isHydrated());

  useEffect(() => {
    // If already hydrated (SPA nav), sync user state immediately
    if (auth.isHydrated()) {
      setUser(auth.getUser());
      setHydrated(true);
    }
    const off = auth.onChange((newUser) => {
      setUser(newUser);
      setHydrated(true); // First callback = initial session check complete
    });
    return () => off();
  }, []);

  return {
    user,
    hydrated,
    isAuthenticated: !!user,
    signOut: () => auth.signOut(),
  };
}
