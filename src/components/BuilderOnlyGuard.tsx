// TODO: Remove builder-only guard before beta launch
import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { isAllowedBuilder } from "@/lib/access";
import { LoadingState } from "@/components/LoadingState";

export function BuilderOnlyGuard({ children }: { children: ReactNode }) {
  const { user, hydrated } = useAuth();

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <LoadingState label="Checking session…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" search={{ mode: "signin" }} />;
  }

  if (!isAllowedBuilder(user.email)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="text-4xl">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900">Private Access Only</h1>
          <p className="text-gray-600">Refurb Genius is currently private during development.</p>
          <p className="text-sm text-gray-400">Signed in as {user.email}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
