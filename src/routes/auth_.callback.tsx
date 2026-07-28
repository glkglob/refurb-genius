import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuthCallbackCompletion } from "@/features/auth";
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
  const { complete } = useAuthCallbackCompletion();
  const { code, type, error: urlError, error_description, redirect_to } = Route.useSearch();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Rejected complete (e.g. no-code getSession network failure) intentionally
    // has no .catch — parity with the pre-extraction getSession branch.
    void complete({
      code,
      type,
      urlError,
      errorDescription: error_description,
      redirectTo: redirect_to,
    }).then((result) => {
      if (!result.ok) {
        setError(result.error);
      }
    });
  }, [code, complete, error_description, redirect_to, type, urlError]);

  if (error) {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <main
          id="main-content"
          tabIndex={-1}
          className="w-full max-w-sm space-y-4 rounded-xl border border-destructive/30 bg-destructive/10 p-8 text-center outline-none"
        >
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" aria-hidden />
          <h1 className="font-semibold text-foreground">Authentication failed</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <a href="/auth" className="text-sm font-medium text-accent hover:underline">
            ← Back to sign in
          </a>
        </main>
      </div>
    );
  }

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-background text-foreground">
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-col items-center gap-3 text-muted-foreground outline-none"
        aria-busy="true"
        aria-live="polite"
      >
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        <p className="text-sm">Completing sign in…</p>
      </main>
    </div>
  );
}
