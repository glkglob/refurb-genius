import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  // IMPORTANT: Defer all auth checks/redirects until after the component has
  // mounted on the client. On server (SSR) and on the very first client render
  // we unconditionally render children. This ensures the DOM produced for
  // hydration exactly matches what _authed beforeLoad decided to send (the
  // real protected content), eliminating hydration mismatches that surface as
  // "Something went wrong" via RootErrorBoundary.
  //
  // After mount the (refetched) client auth state is consulted as a belt-and-
  // suspenders safety net: if the session disappeared we SPA-redirect to /auth.
  // We no longer block with a "Checking session" spinner — the beforeLoad
  // guarantee + instant paint is preserved.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }
  if (!isAuthenticated) {
    const currentPath = typeof window !== "undefined" ? window.location.pathname : undefined;
    return (
      <Navigate
        to="/auth"
        search={currentPath && currentPath !== "/auth" ? { redirect: currentPath } : undefined}
      />
    );
  }
  return <>{children}</>;
}
