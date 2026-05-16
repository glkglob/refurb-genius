import type { ReactNode } from "react";
import { useEffect } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { LoadingState } from "@/components/LoadingState";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, hydrated, isAuthenticated } = useAuth();

  useEffect(() => {
    console.log("[RequireAuth]", {
      path: typeof window !== "undefined" ? window.location.pathname : "(ssr)",
      hydrated,
      isAuthenticated,
      email: user?.email ?? "(none)",
    });
  }, [hydrated, isAuthenticated, user]);
  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <LoadingState label="Checking session…" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/auth" />;
  return <>{children}</>;
}
