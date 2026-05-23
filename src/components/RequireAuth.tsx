import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { LoadingState } from "@/components/LoadingState";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { hydrated, isAuthenticated } = useAuth();

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <LoadingState label="Checking session…" />
      </div>
    );
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
