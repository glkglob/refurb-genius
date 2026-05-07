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
  if (!isAuthenticated) return <Navigate to="/auth" />;
  return <>{children}</>;
}
