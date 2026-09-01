import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuthCallbackCompletion } from "@/features/auth";
import { Loader2, AlertCircle } from "lucide-react";
import { z } from "zod";
import {
  clearAuthCallbackBootstrapCapture,
  stripSensitiveAuthCallbackLocation,
  takeAuthCallbackBootstrapCapture,
} from "@/platform/sentry/replay-privacy";

const callbackSearchSchema = z.object({
  code: z.string().optional(),
  token_hash: z.string().optional(),
  type: z.string().optional(),
  flow: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
  redirect_to: z.string().optional(),
});

export const Route = createFileRoute("/auth_/callback")({
  head: () => ({ meta: [{ title: "Signing in… — Refurb Genius" }] }),
  validateSearch: callbackSearchSchema,
  component: AuthCallback,
});

/**
 * Presentation-owned history cleanup (AO-1F1 invariant: replaceState|history).
 * Uses shared sanitiser; keeps lexical history.replaceState ownership on route.
 *
 * When query-based auth material is present (live or bootstrap), strip hash too.
 * When only hash may drive Supabase detectSessionInUrl, leave hash until after
 * complete() has had a chance to initialise the client.
 */
function stripSensitiveCallbackParamsFromUrl(options: { stripHash: boolean }): void {
  if (typeof window === "undefined") return;
  if (!window.history?.replaceState) return;
  stripSensitiveAuthCallbackLocation(window, { stripHash: options.stripHash });
}

function AuthCallback() {
  const { complete } = useAuthCallbackCompletion();
  const search = Route.useSearch();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    // Exactly-once completion: URL cleanup must not re-trigger exchange.
    if (startedRef.current) return;
    startedRef.current = true;

    // Live route search wins; one-shot pre-init snapshot fills gaps after strip.
    const bootstrap = takeAuthCallbackBootstrapCapture();
    const code = search.code ?? bootstrap?.code;
    const token_hash = search.token_hash ?? bootstrap?.tokenHash;
    const type = search.type ?? bootstrap?.type;
    const { error: urlError, error_description, redirect_to } = search;

    const hasQueryAuth = Boolean(code || token_hash);
    // Query-auth path: full strip (query + hash) is safe — complete uses locals.
    // Hash-only fallback: preserve hash for detectSessionInUrl during complete.
    stripSensitiveCallbackParamsFromUrl({ stripHash: hasQueryAuth });

    // Rejected complete (e.g. no-code getSession network failure) intentionally
    // has no .catch — parity with the pre-extraction getSession branch.
    void complete({
      code,
      tokenHash: token_hash,
      type,
      urlError,
      errorDescription: error_description,
      redirectTo: redirect_to,
    })
      .then((result) => {
        if (!result.ok) {
          setError(result.error);
        }
      })
      .finally(() => {
        // Drop one-shot secrets; strip any residual hash after session attempt.
        clearAuthCallbackBootstrapCapture();
        stripSensitiveCallbackParamsFromUrl({ stripHash: true });
      });
  }, [complete, search]);

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
          <a href="/auth" className="text-sm font-medium text-accent-text hover:underline">
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
