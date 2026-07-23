import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  Eye,
  EyeOff,
  Home,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { supabase } from "@/platform/supabase/browser";
import { auth, fromSupabaseUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { AUTH_USER_QUERY_KEY } from "@/hooks/useAuth";
import { identifyAnalyticsUser, trackEvent, trackSignupCompleted } from "@/lib/analytics";

export type AuthMode = "signin" | "signup" | "reset";

const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 60_000;
const NEW_USER_ONBOARDING_KEY = "refurb-genius:onboarding:new-user";

type AuthExperienceProps = {
  initialMode: AuthMode;
  redirect?: string;
};

function AppleIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="pointer-events-none h-4 w-4 shrink-0"
    >
      <path
        fill="currentColor"
        d="M17.05 20.693c-.474.098-.972.148-1.487.148-.603 0-1.133-.11-1.594-.315l-.726.698c.55.246 1.156.369 1.79.369 1.96 0 3.526-1.586 3.526-3.71s-1.565-3.723-3.525-3.723c-1.102 0-2.04.49-2.686 1.227l-1.232-1.298c.695-.83 1.798-1.348 3.039-1.348 2.467 0 4.534 1.924 4.534 4.433 0 2.513-2.067 4.57-4.674 4.57-.767 0-1.462-.216-2.05-.58l-.795.814c.712.44 1.489.698 2.304.698 2.89 0 5.247-2.377 5.247-5.626 0-3.204-2.34-5.58-5.3-5.58-2.78 0-5.21 2.2-5.512 5.12l-1.753-1.692C11.818 7.946 15.41 5.92 18.985 5.92c4.588 0 8.156 3.598 8.156 8.335 0 4.83-3.72 8.505-8.38 8.505-1.937 0-3.563-1.123-4.252-2.674l-1.365 1.338c.636 1.05 1.847 1.907 3.386 1.907zM12.972.074C5.81.074.075 5.838.074 13c0 7.194 5.73 13.034 12.898 13.034 7.167 0 12.9-5.84 12.9-13.034C25.87 5.838 20.14.074 12.972.074zm0 2.772c5.626 0 10.19 4.564 10.19 10.19 0 5.626-4.564 10.19-10.19 10.19S2.774 18.586 2.774 12.96 7.34 2.772 12.972 2.772z"
      />
    </svg>
  );
}

/** Decorative Lucide icon props — never focusable under aria-hidden. */
const decorativeIconProps = {
  "aria-hidden": true as const,
  focusable: false as const,
  className: "pointer-events-none",
};

export function AuthExperience({ initialMode, redirect }: AuthExperienceProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<AuthMode>(initialMode);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [onboardingGoal, setOnboardingGoal] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    setMode(initialMode);
    setError("");
  }, [initialMode]);

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

    tick();
    const interval = setInterval(tick, 1_000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const isSignIn = mode === "signin";
  const isSignUp = mode === "signup";
  const isReset = mode === "reset";
  const isLocked = remainingSeconds > 0;

  const formDisabled = submitting || oauthLoading || magicLinkLoading || forgotPasswordLoading;

  const pageHeading = useMemo(() => {
    if (isSignIn) return "Welcome back";
    if (isSignUp) return "Create your account";
    return "Reset your password";
  }, [isSignIn, isSignUp]);

  const pageSubheading = useMemo(() => {
    if (isSignIn) return "Sign in to continue analysing UK property refurb opportunities.";
    if (isSignUp) return "Start building investor-grade feasibility studies in minutes.";
    return "Choose a new password to regain access to your account.";
  }, [isSignIn, isSignUp]);

  function destinationAfterAuth() {
    return redirect && !redirect.startsWith("/auth") ? redirect : "/dashboard";
  }

  function clearSensitiveFields() {
    setPassword("");
    setConfirmPassword("");
  }

  async function navigateAfterAuth() {
    await navigate({ to: destinationAfterAuth(), replace: true });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (isLocked && isSignIn) {
      setError(`Too many failed attempts. Please wait ${remainingSeconds} seconds.`);
      return;
    }

    if (!email) {
      setError("Email address is required.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    if (isSignUp) {
      if (!agreeTerms) {
        setError("Please accept the Terms and Privacy Policy to continue.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isSignIn) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;

        queryClient.setQueryData(AUTH_USER_QUERY_KEY, fromSupabaseUser(data.user));
        identifyAnalyticsUser(data.user?.id);
        trackEvent("user_signed_in", { provider: "email" });

        setFailedAttempts(0);
        setLockedUntil(null);
        toast.success("Signed in successfully.");
        await navigateAfterAuth();
        return;
      }

      if (isReset) {
        await auth.updatePassword(password);
        toast.success("Password updated. Please sign in with your new credentials.");
        await navigate({ to: "/auth", search: { mode: "signin", redirect }, replace: true });
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            company_name: company || undefined,
            onboarding_goal: onboardingGoal || undefined,
          },
        },
      });
      if (signUpError) throw signUpError;

      identifyAnalyticsUser(data.user?.id);
      trackSignupCompleted("email", data.user?.id);

      if (data.session) {
        window.localStorage.setItem(NEW_USER_ONBOARDING_KEY, "1");
        queryClient.setQueryData(AUTH_USER_QUERY_KEY, fromSupabaseUser(data.user));
        toast.success("Account created. Welcome to Refurb Genius.");
        await navigateAfterAuth();
      } else {
        setAwaitingVerification(true);
        toast.success("Account created. Check your inbox to verify your email.");
      }
    } catch (err) {
      logger.error("[auth] submit failed", { mode, error: String(err) });
      const message = err instanceof Error ? err.message : "Authentication failed.";

      if (isSignIn) {
        const attempts = failedAttempts + 1;
        setFailedAttempts(attempts);
        if (
          message.toLowerCase().includes("rate limit") ||
          message.toLowerCase().includes("too many requests")
        ) {
          setError("Too many sign-in attempts. Please wait a moment and try again.");
        } else if (attempts >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCKOUT_MS);
          setError("Too many failed attempts. Please wait 60 seconds.");
        } else {
          setError(message);
        }
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleAuth() {
    setError("");
    setOauthLoading(true);
    trackEvent("oauth_sign_in_initiated", { provider: "google" });

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: redirect ? { redirect_to: redirect } : undefined,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      logger.error("[auth] google auth failed", { error: String(err) });
      setError(err instanceof Error ? err.message : "Google sign in failed.");
      setOauthLoading(false);
    }
  }

  async function handleAppleAuth() {
    setError("");
    setAppleLoading(true);
    trackEvent("oauth_sign_in_initiated", { provider: "apple" });

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: redirect ? { redirect_to: redirect } : undefined,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      logger.error("[auth] apple auth failed", { error: String(err) });
      setError(err instanceof Error ? err.message : "Apple sign in failed.");
      setAppleLoading(false);
    }
  }

  async function handleMagicLink() {
    setError("");
    if (!email) {
      setError("Enter your email first to receive a magic link.");
      return;
    }

    setMagicLinkLoading(true);
    try {
      const params = new URLSearchParams();
      if (redirect) params.set("redirect_to", redirect);
      const redirectTo = `${window.location.origin}/auth/callback${
        params.toString() ? `?${params.toString()}` : ""
      }`;

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
        },
      });
      if (otpError) throw otpError;

      toast.success("Magic link sent. Check your inbox.");
    } catch (err) {
      logger.error("[auth] magic link failed", { error: String(err) });
      setError(err instanceof Error ? err.message : "Could not send magic link.");
    } finally {
      setMagicLinkLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    if (!email) {
      setError("Enter your email first to reset your password.");
      return;
    }

    setForgotPasswordLoading(true);
    try {
      await auth.resetPasswordForEmail(email);
      toast.success("Password reset email sent.");
    } catch (err) {
      logger.error("[auth] forgot password failed", { error: String(err) });
      setError(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setForgotPasswordLoading(false);
    }
  }

  function switchMode(nextMode: "signin" | "signup") {
    setMode(nextMode);
    setError("");
    setAwaitingVerification(false);
    clearSensitiveFields();
    void navigate({ to: "/auth", search: { mode: nextMode, redirect }, replace: true });
  }

  if (awaitingVerification) {
    return (
      <AuthPageShell>
        <Card className="border-border/60 bg-card/85 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15">
              <Mail {...decorativeIconProps} className="pointer-events-none h-6 w-6 text-accent" />
            </div>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We sent a verification link to{" "}
              <span className="font-medium text-foreground">{email}</span>. Open it, then sign in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="secondary" onClick={() => switchMode("signin")}>
              Back to sign in
            </Button>
          </CardContent>
        </Card>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-2xl shadow-black/45 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 lg:grid-cols-[1.1fr_1fr]">
        <div className="relative hidden border-r border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(45,212,191,0.14),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(59,130,246,0.14),transparent_35%)]" />
          <div className="relative flex h-full flex-col">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 ring-1 ring-accent/40">
                <Home className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Refurb Genius</p>
                <p className="text-xs text-muted-foreground">
                  AI-Powered UK Property Refurbishment Analysis
                </p>
              </div>
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Investor-grade refurb intelligence in one secure workspace
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Turn property photos into scopes, estimates, and ROI-ready feasibility studies aligned
              to UK market realities.
            </p>

            <div className="mt-8 space-y-3">
              {[
                "Photo analysis and room-level condition scoring",
                "Deterministic refurb estimates and ROI scenarios",
                "Feasibility snapshots for lenders and JV partners",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm text-foreground/90">
                  <Sparkles className="mt-0.5 h-4 w-4 text-accent" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto grid grid-cols-2 gap-3 pt-8">
              <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                <p className="text-xs text-muted-foreground">Built for</p>
                <p className="mt-1 text-sm font-medium">UK Investors</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                <p className="text-xs text-muted-foreground">Security</p>
                <p className="mt-1 text-sm font-medium">Supabase Auth</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
                <Home className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">Refurb Genius</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  AI-Powered UK Property Refurbishment Analysis
                </p>
              </div>
            </div>
          </div>

          <div className="mb-5 rounded-xl border border-border/60 bg-background/50 p-1">
            <div className="grid grid-cols-2 gap-1">
              <Button
                type="button"
                variant={isSignIn ? "default" : "ghost"}
                className="h-10 w-full"
                onClick={() => switchMode("signin")}
                aria-pressed={isSignIn}
              >
                Sign in
              </Button>
              <Button
                type="button"
                variant={isSignUp ? "default" : "ghost"}
                className="h-10 w-full"
                onClick={() => switchMode("signup")}
                aria-pressed={isSignUp}
              >
                Sign up
              </Button>
            </div>
          </div>

          <div className="mb-5">
            <h1 className="text-2xl font-semibold tracking-tight">{pageHeading}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{pageSubheading}</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4" role="alert" aria-live="polite">
              <AlertCircle {...decorativeIconProps} className="pointer-events-none h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLocked && isSignIn && !error && (
            <Alert
              className="mb-4 border-amber-500/40 bg-amber-500/10 text-amber-200"
              role="status"
              aria-live="polite"
            >
              <Lock {...decorativeIconProps} className="pointer-events-none h-4 w-4" />
              <AlertDescription>
                Temporarily locked. Try again in {remainingSeconds}s.
              </AlertDescription>
            </Alert>
          )}

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            {isSignUp && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Alex Morgan"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company">Company (optional)</Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                    placeholder="Northbridge Property Ltd"
                    autoComplete="organization"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="onboarding-goal">What do you want to do first?</Label>
                  <Input
                    id="onboarding-goal"
                    list="onboarding-goals"
                    value={onboardingGoal}
                    onChange={(event) => setOnboardingGoal(event.target.value)}
                    placeholder="Run my first feasibility study"
                  />
                  <datalist id="onboarding-goals">
                    <option value="Run my first feasibility study" />
                    <option value="Estimate refurb costs on a project" />
                    <option value="Model ROI for an investment deal" />
                    <option value="Prepare an investor report export" />
                  </datalist>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.co.uk"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">{isReset ? "New password" : "Password"}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isSignIn ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isSignIn ? "Enter your password" : "Create a strong password"}
                  required
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="absolute right-1 top-1 h-8 w-8"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff {...decorativeIconProps} />
                  ) : (
                    <Eye {...decorativeIconProps} />
                  )}
                </Button>
              </div>
            </div>

            {(isSignUp || isReset) && (
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter password"
                    required
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1 h-8 w-8"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirmation password"
                        : "Show confirmation password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff {...decorativeIconProps} />
                    ) : (
                      <Eye {...decorativeIconProps} />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {isSignUp && (
              <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/40 p-3">
                {/*
                  Native checkbox (not Radix): Radix injects a bubble <input aria-hidden
                  tabIndex={-1}> which fails axe "aria-hidden-focus" because native inputs
                  remain focusable under aria-hidden.
                */}
                <input
                  id="terms-consent"
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(event) => setAgreeTerms(event.target.checked)}
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border border-primary bg-background text-primary",
                    "accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  )}
                />
                <Label
                  htmlFor="terms-consent"
                  className="cursor-pointer text-xs leading-relaxed text-muted-foreground"
                >
                  I agree to the{" "}
                  <a
                    className="text-accent hover:underline"
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Terms
                  </a>{" "}
                  and{" "}
                  <a
                    className="text-accent hover:underline"
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Privacy Policy
                  </a>
                  .
                </Label>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={formDisabled || (isSignIn && isLocked)}
            >
              {submitting ? (
                <>
                  <Loader2
                    {...decorativeIconProps}
                    className="pointer-events-none h-4 w-4 animate-spin"
                  />
                  {isSignIn
                    ? "Signing in..."
                    : isSignUp
                      ? "Creating account..."
                      : "Updating password..."}
                </>
              ) : isSignIn ? (
                "Sign in"
              ) : isSignUp ? (
                "Create account"
              ) : (
                "Update password"
              )}
            </Button>
          </form>

          {!isReset && (
            <>
              <div className="mt-4 flex items-center justify-between text-xs">
                {/* Only show forgot-password on sign-in so a disabled control is not left in the tree. */}
                {isSignIn ? (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-muted-foreground"
                    onClick={handleForgotPassword}
                    disabled={forgotPasswordLoading}
                  >
                    {forgotPasswordLoading ? "Sending reset email..." : "Forgot password?"}
                  </Button>
                ) : (
                  <span />
                )}

                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-muted-foreground"
                  onClick={handleMagicLink}
                  disabled={magicLinkLoading}
                >
                  {magicLinkLoading ? "Sending magic link..." : "Use magic link instead"}
                </Button>
              </div>

              <div className="my-5 flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  or
                </span>
                <Separator className="flex-1" />
              </div>

              <Button
                type="button"
                variant="secondary"
                className="h-10 w-full"
                onClick={handleGoogleAuth}
                disabled={formDisabled || (isSignIn && isLocked)}
              >
                {oauthLoading ? (
                  <>
                    <Loader2
                      {...decorativeIconProps}
                      className="pointer-events-none h-4 w-4 animate-spin"
                    />
                    Connecting...
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    Continue with Google
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="h-10 w-full"
                onClick={handleAppleAuth}
                disabled={formDisabled || (isSignIn && isLocked)}
              >
                {appleLoading ? (
                  <>
                    <Loader2
                      {...decorativeIconProps}
                      className="pointer-events-none h-4 w-4 animate-spin"
                    />
                    Connecting...
                  </>
                ) : (
                  <>
                    <AppleIcon />
                    Continue with Apple
                  </>
                )}
              </Button>
            </>
          )}

          <div className="mt-5 text-center text-xs text-muted-foreground">
            {isSignIn ? "Don't have an account? " : "Already have an account? "}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-accent"
              onClick={() => switchMode(isSignIn ? "signup" : "signin")}
            >
              {isSignIn ? "Sign up" : "Sign in"}
            </Button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck
              {...decorativeIconProps}
              className="pointer-events-none h-3.5 w-3.5 text-accent"
            />
            Secure • Protected by Supabase
          </div>
        </div>
      </div>
    </AuthPageShell>
  );
}

function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_10%,rgba(45,212,191,0.14),transparent_35%),radial-gradient(circle_at_85%_10%,rgba(59,130,246,0.14),transparent_35%),linear-gradient(180deg,oklch(0.12_0.04_265),oklch(0.16_0.04_264))] px-4 py-8 sm:px-6 sm:py-12">
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(to_right,oklch(1_0_0/0.08)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/0.08)_1px,transparent_1px)] [background-size:40px_40px]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        {children}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="pointer-events-none h-4 w-4 shrink-0"
    >
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
