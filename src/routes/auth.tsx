import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/services/supabase";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { identifyAnalyticsUser, trackEvent, trackSignupCompleted } from "@/lib/analytics";
import { fromSupabaseUser } from "@/lib/auth";
import { AUTH_USER_QUERY_KEY } from "@/hooks/useAuth";

// Client-side lockout after repeated failures.
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 60_000;

export const Route = createFileRoute("/auth")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    mode?: "signin" | "signup" | "reset";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { mode = "signin", redirect } = useSearch({ from: "/auth" });

  const [isSignIn, setIsSignIn] = useState(mode !== "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState("");
  // Show verification prompt after sign-up when email confirmation is required.
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  // Rate-limiting state
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);

  const isLocked = remainingSeconds > 0;

  // Countdown timer — ticks every second, drives remainingSeconds display.
  useEffect(() => {
    if (lockedUntil === null) {
      setRemainingSeconds(0);
      return;
    }

    const tick = () => {
      const secs = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (secs <= 0) {
        setRemainingSeconds(0);
        setLockedUntil(null);
        setFailedAttempts(0);
      } else {
        setRemainingSeconds(secs);
      }
    };

    tick(); // run immediately so the display is correct on first render
    const interval = setInterval(tick, 1_000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  /** Navigate to the originally requested URL, falling back to /dashboard. */
  const navigateAfterAuth = () => {
    const destination = redirect && !redirect.startsWith("/auth") ? redirect : "/dashboard";
    void navigate({ to: destination, replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isLocked) {
      setError(`Too many failed attempts. Please wait ${remainingSeconds} seconds.`);
      return;
    }

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    setLoading(true);

    try {
      if (isSignIn) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        identifyAnalyticsUser(data.user?.id);
        trackEvent("user_signed_in", { provider: "email" });

        // Immediately seed the auth query cache with the freshly signed-in
        // user. Without this, the cache still holds the "signed out" (null)
        // result fetched when /auth first loaded (staleTime is 5 minutes),
        // so RequireAuth's post-mount check on the destination page sees
        // isAuthenticated === false and bounces straight back to /auth
        // before the async onAuthStateChange listener can update it.
        queryClient.setQueryData(AUTH_USER_QUERY_KEY, fromSupabaseUser(data.user));

        // Reset rate-limit counters on success.
        setFailedAttempts(0);
        setLockedUntil(null);

        toast.success("Signed in successfully");
        navigateAfterAuth();
      } else {
        // Sign-up — Supabase may or may not return a session depending on
        // whether email confirmation is enabled in the project settings.
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });

        if (signUpError) throw signUpError;

        identifyAnalyticsUser(data.user?.id);
        trackSignupCompleted("email", data.user?.id);

        setFailedAttempts(0);
        setLockedUntil(null);

        if (data.session) {
          // Email confirmation is disabled — user is immediately signed in.
          // Seed the auth query cache for the same reason as the sign-in
          // branch above (avoid a stale "signed out" cache bouncing the
          // user back to /auth immediately after sign-up).
          queryClient.setQueryData(AUTH_USER_QUERY_KEY, fromSupabaseUser(data.user));
          toast.success("Account created! Welcome to Refurb Genius.");
          navigateAfterAuth();
        } else {
          // Email confirmation is required — stay on the auth page and
          // prompt the user to check their inbox.
          setAwaitingVerification(true);
          toast.success("Account created! Please check your email to confirm your address.");
        }
      }
    } catch (err) {
      logger.error("[auth] authentication failed", { error: String(err) });

      const message = err instanceof Error ? err.message : "Authentication failed";

      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);

      if (
        message.toLowerCase().includes("rate limit") ||
        message.toLowerCase().includes("too many requests")
      ) {
        setError("Too many sign-in attempts. Please wait a moment and try again.");
      } else if (newAttempts >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_MS);
        setError("Too many failed attempts. Please wait 60 seconds.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setOauthLoading(true);
    setError("");
    trackEvent("oauth_sign_in_initiated", { provider: "google" });

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: redirect ? { redirect_to: redirect } : undefined,
        },
      });

      if (error) throw error;
    } catch (err) {
      logger.error("[auth] Google sign-in failed", { error: String(err) });
      setError(err instanceof Error ? err.message : "Google sign in failed");
      setOauthLoading(false);
    }
  };

  // Email-verification holding screen
  if (awaitingVerification) {
    return (
      <AuthShell>
        <div className="flex flex-1 items-center justify-center px-6 py-10 md:px-10">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/60 p-8 text-center shadow-xl shadow-slate-950/60">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
              <svg
                className="h-6 w-6 text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-50">Check your email</h2>
            <p className="mt-2 text-sm text-slate-400">
              We sent a confirmation link to{" "}
              <span className="font-medium text-slate-200">{email}</span>. Click it to activate your
              account, then sign in below.
            </p>
            <button
              type="button"
              onClick={() => setAwaitingVerification(false)}
              className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </AuthShell>
    );
  }

  const heading = isSignIn ? "Sign in" : "Create your account";
  const subtitle = isSignIn
    ? "Welcome back. Sign in to continue analysing your UK property deals."
    : "Start using Refurb Genius to estimate refurbishment costs and analyse deals.";

  return (
    <AuthShell>
      {/* ── Right panel: form ─────────────────────────────────────── */}
      <main className="flex flex-1 items-center justify-center px-6 py-10 md:px-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/60">
          {/* Heading */}
          <div className="mb-6 space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-slate-50">{heading}</h2>
            <p className="text-sm text-slate-400">{subtitle}</p>
          </div>

          {/* Error / lockout banners */}
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
            >
              {error}
            </div>
          )}
          {isLocked && !error && (
            <div
              role="status"
              className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
            >
              Account temporarily locked. Try again in {remainingSeconds}s.
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {!isSignIn && (
              <div className="space-y-1.5">
                <Label
                  htmlFor="fullName"
                  className="text-xs font-medium uppercase tracking-wide text-slate-400"
                >
                  Full name
                </Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Smith"
                  required
                  className="border-slate-800 bg-slate-900/70 text-slate-50 placeholder:text-slate-600 focus-visible:ring-emerald-500/40"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-medium uppercase tracking-wide text-slate-400"
              >
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.co.uk"
                required
                className="border-slate-800 bg-slate-900/70 text-slate-50 placeholder:text-slate-600 focus-visible:ring-emerald-500/40"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-xs font-medium uppercase tracking-wide text-slate-400"
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete={isSignIn ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignIn ? "Your password" : "Create a strong password"}
                required
                className="border-slate-800 bg-slate-900/70 text-slate-50 placeholder:text-slate-600 focus-visible:ring-emerald-500/40"
              />
            </div>

            <Button
              type="submit"
              className="mt-2 w-full bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-60"
              disabled={loading || oauthLoading || isLocked}
            >
              {loading
                ? isSignIn
                  ? "Signing you in…"
                  : "Creating your account…"
                : isSignIn
                  ? "Sign in"
                  : "Create account"}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Or continue with
            </span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={oauthLoading || loading || isLocked}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleIcon />
            {oauthLoading ? "Connecting…" : "Continue with Google"}
          </button>

          {/* Toggle sign-in / sign-up */}
          <p className="mt-6 text-center text-xs text-slate-500">
            {isSignIn ? "Don't have an account yet? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => {
                setIsSignIn(!isSignIn);
                setError("");
              }}
              className="font-medium text-emerald-400 underline-offset-2 hover:underline"
            >
              {isSignIn ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </main>
    </AuthShell>
  );
}

// ─── Shared shell: dark two-column layout ─────────────────────────────────────

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col md:flex-row">
        {/* ── Left panel: brand ─────────────────────────────────────── */}
        <aside className="flex flex-col justify-between bg-gradient-to-b from-slate-900 to-slate-950 px-8 py-8 md:w-[420px] md:py-12 md:px-12">
          {/* Logo */}
          <header className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
              <span className="text-sm font-bold text-emerald-400">RG</span>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-slate-50">Refurb Genius</p>
              <p className="text-[11px] text-slate-500">AI-powered refurbishment analysis</p>
            </div>
          </header>

          {/* Hero copy */}
          <section className="mt-12 space-y-4 md:mt-0">
            <h1 className="text-3xl font-semibold leading-snug tracking-tight md:text-4xl">
              See your numbers before you pick up a hammer.
            </h1>
            <p className="max-w-xs text-sm leading-relaxed text-slate-400">
              Upload photos and property details in minutes. Get structured refurb estimates, budget
              breakdowns, and deal analysis tailored to the UK market.
            </p>
            <ul className="mt-4 space-y-2">
              {[
                "Fast estimates for single lets, HMOs, and flips",
                "Built for UK trades, materials, and compliance",
                "Deal Copilot to model ROI before you bid",
              ].map((feat) => (
                <li key={feat} className="flex items-start gap-2 text-sm text-emerald-300">
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[10px]">
                    ✓
                  </span>
                  {feat}
                </li>
              ))}
            </ul>
          </section>

          {/* Footer */}
          <footer className="mt-12 flex items-center justify-between text-[11px] text-slate-600 md:mt-0">
            <span>Secure sign-in · Powered by Supabase Auth</span>
            <span>© {new Date().getFullYear()} Refurb Genius</span>
          </footer>
        </aside>

        {children}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-.9 2.4-2 3.1l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.4-.2-2H12z"
      />
      <path
        fill="#34A853"
        d="M6.6 14.3l-.9.7-2.5 1.9C4.8 19.9 8.2 22 12 22c2.4 0 4.5-.8 6-2.3l-3.1-2.4c-.8.6-1.9 1-2.9 1-2.3 0-4.2-1.5-4.9-3.6z"
      />
      <path
        fill="#4A90E2"
        d="M3.2 6.9C2.4 8.2 2 9.6 2 11c0 1.4.4 2.8 1.2 4.1l3.4-2.6c-.2-.6-.3-1.2-.3-1.9 0-.6.1-1.3.3-1.9z"
      />
      <path
        fill="#FBBC05"
        d="M12 4.8c1.3 0 2.4.4 3.3 1.2l2.4-2.4C16.5 2.1 14.4 1.2 12 1.2 8.2 1.2 4.8 3.3 3.2 6.9l3.7 2.8C7.8 6.3 9.7 4.8 12 4.8z"
      />
    </svg>
  );
}
