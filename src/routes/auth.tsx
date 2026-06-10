import { createFileRoute } from "@tanstack/react-router";
import { AuthExperience, type AuthMode } from "@/features/auth";

export const Route = createFileRoute("/auth")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    mode?: AuthMode;
    redirect?: string;
  } => {
    const mode = search.mode as string | undefined;
    const redirect = typeof search.redirect === "string" ? search.redirect : undefined;
    return {
      mode: mode === "signup" || mode === "reset" ? mode : "signin",
      redirect,
    };
  },
  component: AuthPage,
});

function AuthPage() {
  const { mode, redirect } = Route.useSearch();
  return <AuthExperience initialMode={mode ?? "signin"} redirect={redirect} />;
}
