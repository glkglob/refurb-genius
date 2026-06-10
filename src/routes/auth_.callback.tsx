import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/platform/supabase/browser";
import { fromSupabaseUser } from "@/lib/auth";
import { AUTH_USER_QUERY_KEY } from "@/hooks/useAuth";
import { Loader2, AlertCircle } from "lucide-react";
import { z } from "zod";

const callbackSearchSchema = z.object({
  code: z.string().optional(),
  type: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
  redirect_to: z.string().optional(),
});

export const Route = createFileRoute("/auth_/callback")({
  head: () => ({ meta: [{ title: "Signing in… — Refurb Genius" }] }),
  validateSearch: callbackSearchSchema,
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { code, type, error: urlError, error_description, redirect_to } = Route.useSearch();
  const [error, setError] = useState<string | null>(null);
  const destination = redirect_to && redirect_to.startsWith("/") ? redirect_to : "/dashboard";

  useEffect(() => {
    if (urlError) {
      setError(error_description ?? urlError);
      return;
    }

    if (!code) {
      // No PKCE code — check if a session already exists (e.g. fragment-based flow)
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          // Seed the auth query cache before navigating so RequireAuth's
          // post-mount check on /dashboard doesn't see the stale
          // "signed out" cache entry and bounce back to /auth. See the
          // matching comment in src/routes/auth.tsx for full context.
          queryClient.setQueryData(AUTH_USER_QUERY_KEY, fromSupabaseUser(data.session.user));
          void navigate({ to: destination, replace: true });
        } else {
          setError("No authentication code received. Please try signing in again.");
        }
      });
      return;
    }

    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ data, error: exchangeError }) => {
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
        if (type === "recovery") {
          void navigate({ to: "/auth", search: { mode: "reset" }, replace: true });
        } else {
          // Seed the auth query cache before navigating — see comment above
          // and the matching fix in src/routes/auth.tsx.
          queryClient.setQueryData(AUTH_USER_QUERY_KEY, fromSupabaseUser(data.user));
          void navigate({ to: destination, replace: true });
        }
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Auth callback failed.");
      });
  }, [code, destination, error_description, navigate, queryClient, redirect_to, type, urlError]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-4 rounded-xl border border-destructive/30 bg-destructive/10 p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <h2 className="font-semibold text-foreground">Authentication failed</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <a href="/auth" className="text-sm font-medium text-accent hover:underline">
            ← Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Completing sign in…</p>
      </div>
    </div>
  );
}
