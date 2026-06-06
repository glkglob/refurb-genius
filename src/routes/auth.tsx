import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/services/supabase";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { identifyAnalyticsUser, trackEvent, trackSignupCompleted } from "@/lib/analytics";

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
              account, then sign in below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setAwaitingVerification(false)}
            >
              Back to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isSignIn ? "Sign in" : "Create account"}</CardTitle>
          <CardDescription>
            {isSignIn ? "Welcome back to Refurb Genius" : "Join the UK property refurb platform"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isSignIn && (
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Smith"
                  required
                />
              </div>
            )}

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isLocked && (
              <Alert>
                <AlertDescription>
                  Account temporarily locked. Try again in {remainingSeconds} seconds.
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={loading || oauthLoading || isLocked}>
              {loading ? "Processing…" : isSignIn ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <div className="mt-6">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={oauthLoading || isLocked}
            >
              {oauthLoading ? "Connecting…" : "Continue with Google"}
            </Button>
          </div>

          <div className="mt-6 text-center text-sm">
            {isSignIn ? (
              <p>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignIn(false);
                    setError("");
                  }}
                  className="text-blue-600 hover:underline"
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignIn(true);
                    setError("");
                  }}
                  className="text-blue-600 hover:underline"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
