import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useRole } from "@/hooks/useRole";
import { LoadingState } from "@/components/LoadingState";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { roleHydrated, isAdmin } = useRole();
  if (!roleHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <LoadingState label="Checking permissions…" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" />;
  return <>{children}</>;
}
