import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Github,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@repo/ui/label";
import { Separator } from "@repo/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { useAuthPasswordCredentials } from "./hooks/useAuthPasswordCredentials";
import { useOAuthSignIn } from "./hooks/useOAuthSignIn";
import { useAuthEmailAccess } from "./hooks/useAuthEmailAccess";

export type AuthMode = "signin" | "signup" | "reset";

const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 60_000;

type AuthExperienceProps = {
  initialMode: AuthMode;
  redirect?: string;
};

/** Decorative Lucide icon props — never focusable under aria-hidden. */
function decorativeIconProps(className?: string) {
  return {
    "aria-hidden": true as const,
    focusable: false as const,
    className: cn("pointer-events-none", className),
  };
}

const fieldClassName = cn(
  "h-14 min-h-[52px] rounded-2xl border-[#d8d1c7] bg-white px-4 text-[#111827]",
  "placeholder:text-[#5f5a54]/70",
  "focus-visible:border-[#0f766e] focus-visible:ring-2 focus-visible:ring-[#0f766e]/30",
);

const primaryButtonClassName = cn(
  "h-14 min-h-11 w-full rounded-2xl bg-[#0f766e] text-base font-semibold text-white",
  "hover:bg-[#115e59] focus-visible:ring-2 focus-visible:ring-[#0f766e]/40 focus-visible:ring-offset-2",
  "disabled:opacity-60",
);

const outlineButtonClassName = cn(
  "h-12 min-h-11 w-full rounded-2xl border-[#d8d1c7] bg-white text-[#111827]",
  "hover:bg-[#f7f5f2] focus-visible:ring-2 focus-visible:ring-[#0f766e]/25",
);

const legalLinkClassName =
  "font-medium text-[#0f766e] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]/40 rounded-sm";

const AUTH_VALUE_CARDS = [
  {
    label: "Output",
    title: "Feasibility studies",
    body: "Structured scopes and cost ranges for investor decisions.",
  },
  {
    label: "Workflow",
    title: "Scenario comparison",
    body: "Compare assumptions without losing your working context.",
  },
  {
    label: "Audience",
    title: "UK property investors",
    body: "Built for refurbishment and development decision-making.",
  },
] as const;

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

export function AuthExperience({ initialMode, redirect }: AuthExperienceProps) {
  const navigate = useNavigate();
  const { signInWithPassword, signUpWithPassword } = useAuthPasswordCredentials();
  const { startGoogleOAuth, startAppleOAuth, startGitHubOAuth } = useOAuthSignIn();
  const { sendMagicLink, requestPasswordReset, updatePassword } = useAuthEmailAccess();

  const [mode, setMode] = useState<AuthMode>(initialMode);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [githubLoading, setGitHubLoading] = useState(false);
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

  const formDisabled =
    submitting ||
    oauthLoading ||
    appleLoading ||
    githubLoading ||
    magicLinkLoading ||
    forgotPasswordLoading;

  const pageEyebrow = useMemo(() => {
    if (isSignIn) return "Sign in";
    if (isSignUp) return "Sign up";
    return "Account recovery";
  }, [isSignIn, isSignUp]);

  const pageHeading = useMemo(() => {
    if (isSignIn) return "Welcome back to your investor workspace";
    if (isSignUp) return "Create your investor workspace";
    return "Set a new password";
  }, [isSignIn, isSignUp]);

  const pageSubheading = useMemo(() => {
    if (isSignIn)
      return "Continue analysing refurbishment costs, scenarios, and property opportunities.";
    if (isSignUp) return "Start building investor-grade feasibility studies in minutes.";
    return "Choose a secure new password to regain access to your workspace.";
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

    if (!isReset && !email) {
      setError("Email address is required.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    if (isSignUp && !agreeTerms) {
      setError("Please accept the Terms and Privacy Policy to continue.");
      return;
    }

    if (isSignUp || isReset) {
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
        await signInWithPassword(email, password);

        setFailedAttempts(0);
        setLockedUntil(null);
        toast.success("Signed in successfully.");
        await navigateAfterAuth();
        return;
      }

      if (isReset) {
        await updatePassword(password);
        toast.success("Password updated. Please sign in with your new credentials.");
        await navigate({ to: "/auth", search: { mode: "signin", redirect }, replace: true });
        return;
      }

      const outcome = await signUpWithPassword({
        email,
        password,
        fullName: name.trim() || undefined,
        companyName: company.trim() || undefined,
      });

      if (outcome === "session") {
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

    try {
      await startGoogleOAuth(redirect);
    } catch (err) {
      logger.error("[auth] google auth failed", { error: String(err) });
      setError(err instanceof Error ? err.message : "Google sign in failed.");
      setOauthLoading(false);
    }
  }

  async function handleAppleAuth() {
    setError("");
    setAppleLoading(true);

    try {
      await startAppleOAuth(redirect);
    } catch (err) {
      logger.error("[auth] apple auth failed", { error: String(err) });
      setError(err instanceof Error ? err.message : "Apple sign in failed.");
      setAppleLoading(false);
    }
  }

  async function handleGitHubAuth() {
    setError("");
    setGitHubLoading(true);

    try {
      await startGitHubOAuth(redirect);
    } catch (err) {
      logger.error("[auth] GitHub OAuth failed", {
        error: String(err),
      });

      setError(err instanceof Error ? err.message : "Could not continue with GitHub.");

      setGitHubLoading(false);
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
      await sendMagicLink(email, redirect);
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
      await requestPasswordReset(email);
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

  const headerActionLabel = isSignUp || isReset ? "Sign in" : "Sign up";
  const headerActionMode: "signin" | "signup" = isSignUp || isReset ? "signin" : "signup";

  return (
    <AuthPageShell
      headerActionLabel={headerActionLabel}
      onHeaderAction={() => switchMode(headerActionMode)}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-6 pb-14 pt-2 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:px-10 lg:pb-16">
        <AuthProductPanel className="order-2 lg:order-1" compactOnMobile />

        <section
          className="order-1 flex flex-col justify-center lg:order-2"
          aria-label="Authentication"
        >
          <div
            className={cn(
              "w-full rounded-[32px] border border-[#d8d1c7] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.10),0_10px_30px_rgba(17,24,39,0.08)]",
              "sm:p-8 lg:p-10",
            )}
          >
            {awaitingVerification ? (
              <VerificationPanel email={email} onBack={() => switchMode("signin")} />
            ) : (
              <>
                <div className="mb-6 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0f766e]">
                    {pageEyebrow}
                  </p>
                  <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-[#111827] sm:text-[2rem]">
                    {pageHeading}
                  </h1>
                  <p className="text-sm leading-relaxed text-[#5f5a54] sm:text-[0.95rem]">
                    {pageSubheading}
                  </p>

                  {!isReset && (
                    <div
                      className="mt-4 rounded-2xl border border-[#d8d1c7] bg-[#f7f5f2] p-1"
                      role="group"
                      aria-label="Authentication mode"
                    >
                      <div className="grid grid-cols-2 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          className={cn(
                            "h-11 w-full rounded-xl text-sm font-medium",
                            isSignIn
                              ? "bg-white text-[#111827] shadow-sm hover:bg-white"
                              : "text-[#5f5a54] hover:bg-white/60 hover:text-[#111827]",
                          )}
                          onClick={() => switchMode("signin")}
                          aria-pressed={isSignIn}
                        >
                          Sign in
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className={cn(
                            "h-11 w-full rounded-xl text-sm font-medium",
                            isSignUp
                              ? "bg-white text-[#111827] shadow-sm hover:bg-white"
                              : "text-[#5f5a54] hover:bg-white/60 hover:text-[#111827]",
                          )}
                          onClick={() => switchMode("signup")}
                          aria-pressed={isSignUp}
                        >
                          Sign up
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <Alert
                    variant="destructive"
                    className="mb-5 border-red-200 bg-red-50 text-red-900"
                    role="alert"
                    aria-live="assertive"
                  >
                    <AlertCircle {...decorativeIconProps("h-4 w-4 text-red-700")} />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {isLocked && isSignIn && !error && (
                  <Alert
                    className="mb-5 border-amber-200 bg-amber-50 text-amber-950"
                    role="status"
                    aria-live="polite"
                  >
                    <Lock {...decorativeIconProps("h-4 w-4 text-amber-700")} />
                    <AlertDescription>
                      Temporarily locked. Try again in {remainingSeconds}s.
                    </AlertDescription>
                  </Alert>
                )}

                <form className="space-y-5" onSubmit={handleSubmit} noValidate>
                  {!isReset && (
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-[#111827]">
                        Email address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@company.co.uk"
                        required
                        disabled={formDisabled}
                        aria-describedby={isSignUp ? "email-hint" : undefined}
                        className={fieldClassName}
                      />
                      {isSignUp && (
                        <p id="email-hint" className="text-xs text-[#5f5a54]">
                          We&apos;ll use this for sign-in and account recovery.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="password" className="text-[#111827]">
                        {isReset ? "New password" : "Password"}
                      </Label>
                      {isSignIn && (
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-sm font-medium text-[#0f766e] hover:text-[#115e59]"
                          onClick={handleForgotPassword}
                          disabled={formDisabled}
                        >
                          {forgotPasswordLoading ? "Sending reset email..." : "Forgot password?"}
                        </Button>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={isSignIn ? "current-password" : "new-password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder={isSignIn ? "Enter your password" : "At least 6 characters"}
                        required
                        disabled={formDisabled || (isSignIn && isLocked)}
                        aria-describedby={isSignUp ? "password-hint" : undefined}
                        className={cn(fieldClassName, "pr-12")}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="absolute right-1.5 top-1.5 h-11 w-11 rounded-xl text-[#5f5a54] hover:bg-[#f7f5f2] hover:text-[#111827]"
                        onClick={() => setShowPassword((current) => !current)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        disabled={formDisabled}
                      >
                        {showPassword ? (
                          <EyeOff {...decorativeIconProps("h-4 w-4")} />
                        ) : (
                          <Eye {...decorativeIconProps("h-4 w-4")} />
                        )}
                      </Button>
                    </div>
                    {isSignUp && (
                      <p id="password-hint" className="text-xs text-[#5f5a54]">
                        Minimum 6 characters. You can change this later from your account.
                      </p>
                    )}
                  </div>

                  {(isSignUp || isReset) && (
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="text-[#111827]">
                        Confirm password
                      </Label>
                      <div className="relative">
                        <Input
                          id="confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="Re-enter password"
                          required
                          disabled={formDisabled}
                          className={cn(fieldClassName, "pr-12")}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="absolute right-1.5 top-1.5 h-11 w-11 rounded-xl text-[#5f5a54] hover:bg-[#f7f5f2] hover:text-[#111827]"
                          onClick={() => setShowConfirmPassword((current) => !current)}
                          aria-label={
                            showConfirmPassword
                              ? "Hide confirmation password"
                              : "Show confirmation password"
                          }
                          disabled={formDisabled}
                        >
                          {showConfirmPassword ? (
                            <EyeOff {...decorativeIconProps("h-4 w-4")} />
                          ) : (
                            <Eye {...decorativeIconProps("h-4 w-4")} />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {isSignUp && (
                    <fieldset className="space-y-3 rounded-2xl border border-[#d8d1c7] bg-[#f7f5f2] p-4 sm:p-5">
                      <legend className="flex items-center gap-2 px-1 text-sm font-medium text-[#111827]">
                        Optional profile details
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#5f5a54] ring-1 ring-[#d8d1c7]">
                          Optional
                        </span>
                      </legend>
                      <p className="text-xs text-[#5f5a54]">
                        Helps personalise your workspace. You can skip and add later.
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="name" className="text-[#111827]">
                            Full name
                          </Label>
                          <Input
                            id="name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Alex Morgan"
                            autoComplete="name"
                            disabled={formDisabled}
                            className={fieldClassName}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="company" className="text-[#111827]">
                            Company
                          </Label>
                          <Input
                            id="company"
                            value={company}
                            onChange={(event) => setCompany(event.target.value)}
                            placeholder="Northbridge Property Ltd"
                            autoComplete="organization"
                            disabled={formDisabled}
                            className={fieldClassName}
                          />
                        </div>
                      </div>
                    </fieldset>
                  )}

                  {isSignUp && (
                    <div className="flex items-start gap-3 rounded-2xl border border-[#d8d1c7] bg-white p-4">
                      {/*
                        Native checkbox (not Radix): Radix injects a bubble <input aria-hidden
                        tabIndex={-1}> which fails axe "aria-hidden-focus".
                      */}
                      <input
                        id="terms-consent"
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={(event) => setAgreeTerms(event.target.checked)}
                        disabled={formDisabled}
                        className={cn(
                          "mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded-md border border-[#d8d1c7]",
                          "accent-[#0f766e]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]/40 focus-visible:ring-offset-2",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                        )}
                      />
                      <div className="text-sm leading-relaxed text-[#5f5a54]">
                        <Label
                          htmlFor="terms-consent"
                          className="cursor-pointer text-sm leading-relaxed text-[#5f5a54]"
                        >
                          I agree to the
                        </Label>{" "}
                        <a
                          href="/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className={legalLinkClassName}
                        >
                          Terms
                        </a>{" "}
                        and{" "}
                        <a
                          href="/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className={legalLinkClassName}
                        >
                          Privacy Policy
                        </a>
                        .
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    className={primaryButtonClassName}
                    disabled={formDisabled || (isSignIn && isLocked)}
                  >
                    {submitting ? (
                      <>
                        <Loader2 {...decorativeIconProps("h-4 w-4 animate-spin")} />
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
                  <p className="mt-4 flex items-center justify-center gap-2 text-xs text-[#5f5a54]">
                    <Check {...decorativeIconProps("h-3.5 w-3.5 text-[#0f766e]")} />
                    <span>Secure • Protected by Supabase</span>
                  </p>
                )}

                {!isReset && (
                  <div className="mt-6 space-y-4">
                    <div
                      className="flex items-center gap-3"
                      role="separator"
                      aria-label="Or continue with social account"
                    >
                      <Separator className="flex-1 bg-[#d8d1c7]" />
                      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#5f5a54]">
                        Or continue with
                      </span>
                      <Separator className="flex-1 bg-[#d8d1c7]" />
                    </div>

                    <div className="grid gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className={outlineButtonClassName}
                        onClick={handleMagicLink}
                        disabled={formDisabled}
                        aria-describedby="magic-link-hint"
                      >
                        {magicLinkLoading ? (
                          <>
                            <Loader2 {...decorativeIconProps("h-4 w-4 animate-spin")} />
                            Sending magic link...
                          </>
                        ) : (
                          <>
                            <Mail {...decorativeIconProps("h-4 w-4")} />
                            Continue with magic link
                          </>
                        )}
                      </Button>
                      <p id="magic-link-hint" className="text-xs text-[#5f5a54]">
                        Uses the email address above. Check your inbox for a secure sign-in link.
                      </p>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          type="button"
                          variant="outline"
                          className={outlineButtonClassName}
                          onClick={handleGoogleAuth}
                          disabled={formDisabled || (isSignIn && isLocked)}
                        >
                          {oauthLoading ? (
                            <>
                              <Loader2 {...decorativeIconProps("h-4 w-4 animate-spin")} />
                              Connecting to Google...
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
                          variant="outline"
                          className={outlineButtonClassName}
                          onClick={handleAppleAuth}
                          disabled={formDisabled || (isSignIn && isLocked)}
                        >
                          {appleLoading ? (
                            <>
                              <Loader2 {...decorativeIconProps("h-4 w-4 animate-spin")} />
                              Connecting to Apple...
                            </>
                          ) : (
                            <>
                              <AppleIcon />
                              Continue with Apple
                            </>
                          )}
                        </Button>

                        <div className="sm:col-span-2">
                          <Button
                            type="button"
                            variant="outline"
                            className={outlineButtonClassName}
                            onClick={handleGitHubAuth}
                            disabled={formDisabled || (isSignIn && isLocked)}
                          >
                            {githubLoading ? (
                              <>
                                <Loader2 {...decorativeIconProps("h-4 w-4 animate-spin")} />
                                Connecting to GitHub...
                              </>
                            ) : (
                              <>
                                <Github {...decorativeIconProps("h-4 w-4")} />
                                Continue with GitHub
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!isReset && (
                  <div className="mt-6 text-center text-sm text-[#5f5a54]">
                    {isSignIn ? "New to Refurb Genius? " : "Already have an account? "}
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-sm font-semibold text-[#0f766e] hover:text-[#115e59]"
                      onClick={() => switchMode(isSignIn ? "signup" : "signin")}
                    >
                      {isSignIn ? "Create an account" : "Sign in"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </AuthPageShell>
  );
}

function VerificationPanel({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ece7df]">
        <Mail {...decorativeIconProps("h-6 w-6 text-[#0f766e]")} />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">Check your email</h1>
        <p className="text-sm leading-relaxed text-[#5f5a54]">
          We sent a verification link to <span className="font-medium text-[#111827]">{email}</span>
          . Open it, then sign in.
        </p>
      </div>
      <Button type="button" className={primaryButtonClassName} onClick={onBack}>
        Back to sign in
      </Button>
    </div>
  );
}

function AuthPageShell({
  children,
  headerActionLabel,
  onHeaderAction,
}: {
  children: React.ReactNode;
  headerActionLabel: string;
  onHeaderAction: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#f7f5f2] text-[#111827]">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-5 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-sm font-semibold text-white"
            aria-hidden="true"
          >
            RG
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#111827]">Refurb Genius</p>
            <p className="truncate text-xs text-[#5f5a54]">Property refurbishment analysis</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0 rounded-2xl border-[#d8d1c7] bg-white px-4 text-sm font-medium text-[#111827] hover:bg-white"
          onClick={onHeaderAction}
        >
          {headerActionLabel}
        </Button>
      </header>

      <main id="main-content" tabIndex={-1} className="outline-none">
        {children}
      </main>
    </div>
  );
}

function AuthProductPanel({
  className,
  compactOnMobile,
}: {
  className?: string;
  compactOnMobile?: boolean;
}) {
  return (
    <aside
      role="region"
      className={cn(
        "flex flex-col justify-center",
        compactOnMobile && "max-lg:border-t max-lg:border-[#d8d1c7] max-lg:pt-8",
        className,
      )}
      aria-label="Product overview"
    >
      <div className="rounded-[32px] border border-[#d8d1c7] bg-[#ece7df] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8 lg:p-10">
        <span className="inline-flex rounded-full bg-[#0f766e]/10 px-3 py-1 text-xs font-semibold text-[#0f766e] ring-1 ring-[#0f766e]/20">
          AI-powered UK property analysis
        </span>

        <h2 className="mt-5 text-[2rem] font-semibold leading-[1.1] tracking-tight text-[#111827] sm:text-[2.25rem] lg:text-[3.5rem] lg:leading-[1.05]">
          Build investor-grade refurbishment feasibility faster.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#5f5a54] sm:text-base">
          Estimate refurb costs, compare scenarios, and structure UK deal decisions with a calmer,
          more reliable workflow.
        </p>

        <div
          className={cn(
            "mt-8 grid gap-3",
            compactOnMobile ? "max-lg:hidden sm:grid-cols-3 lg:grid" : "sm:grid-cols-3",
          )}
          data-testid="desktop-value-panel"
        >
          {AUTH_VALUE_CARDS.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-[#d8d1c7] bg-white/80 p-4 shadow-sm"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0f766e]">
                {card.label}
              </p>
              <p className="mt-2 text-sm font-semibold text-[#111827]">{card.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#5f5a54]">{card.body}</p>
            </div>
          ))}
        </div>

        <div
          className={cn(
            "mt-5 rounded-2xl border border-stone-800 bg-[#0c0a09] p-5 text-stone-100",
            compactOnMobile && "max-lg:hidden",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
              Sample output
            </p>
            <span className="rounded-full bg-stone-800 px-2 py-0.5 text-[10px] font-medium text-stone-300 ring-1 ring-stone-700">
              Illustrative
            </span>
          </div>
          <p className="mt-2 text-base font-semibold text-white">Refurb appraisal snapshot</p>
          <p className="mt-1 text-xs text-stone-400">
            Example figures for layout only — not a live estimate.
          </p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-stone-400">Budget range</dt>
              <dd className="mt-0.5 font-medium text-white">£28k–£41k</dd>
            </div>
            <div>
              <dt className="text-stone-400">Risk flags</dt>
              <dd className="mt-0.5 font-medium text-white">3</dd>
            </div>
            <div>
              <dt className="text-stone-400">Decision view</dt>
              <dd className="mt-0.5 font-medium text-white">Clearer</dd>
            </div>
          </dl>
        </div>

        <div
          className={cn(
            "mt-5 rounded-2xl border border-[#d8d1c7] bg-white/90 p-5",
            compactOnMobile && "max-lg:mt-5",
          )}
        >
          <p className="text-sm font-semibold text-[#111827]">A more structured workspace</p>
          <ul className="mt-3 space-y-2 text-sm text-[#5f5a54]">
            <li className="flex gap-2">
              <Check {...decorativeIconProps("mt-0.5 h-4 w-4 shrink-0 text-[#0f766e]")} />
              Organise refurbishment assumptions in one place
            </li>
            <li className="flex gap-2">
              <Check {...decorativeIconProps("mt-0.5 h-4 w-4 shrink-0 text-[#0f766e]")} />
              Compare cost scenarios without losing context
            </li>
            <li className="flex gap-2">
              <Check {...decorativeIconProps("mt-0.5 h-4 w-4 shrink-0 text-[#0f766e]")} />
              Keep feasibility information together for decisions
            </li>
          </ul>
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#f7f5f2] p-3">
            <ShieldCheck {...decorativeIconProps("mt-0.5 h-4 w-4 shrink-0 text-[#0f766e]")} />
            <div>
              <p className="text-sm font-medium text-[#111827]">Secure sign-in</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[#5f5a54]">
                Protected authentication with Supabase.
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
