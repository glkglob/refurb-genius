import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, type FormEvent } from "react";
import { auth } from "@/lib/auth";
import { Loader2, AlertCircle } from "lucide-react";
import { z } from "zod";

const authSearchSchema = z.object({
  mode: z.enum(["signin", "signup", "forgot", "reset"]).default("signin").catch("signin"),
  /** Destination to redirect to after a successful sign-in or sign-up. */
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Sign in — Refurb Genius" }],
  }),
  validateSearch: authSearchSchema,
  component: AuthPage,
});

function AuthPage() {
  const { mode, redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const titles: Record<string, string> = {
      signin: "Sign in — Refurb Genius",
      signup: "Create account — Refurb Genius",
      forgot: "Reset password — Refurb Genius",
      reset: "Set new password — Refurb Genius",
    };
    document.title = titles[mode] ?? "Sign in — Refurb Genius";
  }, [mode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      // After auth, go to intended destination (if safe) or dashboard.
      const destination =
        redirect && redirect.startsWith("/") && !redirect.startsWith("//")
          ? redirect
          : "/dashboard";
      if (mode === "signin") {
        await auth.signIn(email.trim(), password);
        navigate({ to: destination });
      } else if (mode === "signup") {
        await auth.signUp(email.trim(), password, fullName.trim());
        navigate({ to: destination });
      } else if (mode === "forgot") {
        await auth.resetPasswordForEmail(email.trim());
        setSuccess("Check your inbox — we've sent a password reset link.");
      } else if (mode === "reset") {
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        await auth.updatePassword(password);
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    setError(null);
    setSuccess(null);
    navigate({ to: "/auth", search: { mode: mode === "signin" ? "signup" : "signin" } });
  };

  // ── Reset password mode ──────────────────────────────────────────────────
  if (mode === "reset") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto flex max-w-md flex-col px-6 py-16">
          <Card>
            <CardContent className="p-8">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Set new password
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a new password for your account.
              </p>
              <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    required
                    minLength={6}
                  />
                </div>
                {error && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Updating…" : "Update password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Forgot password mode ─────────────────────────────────────────────────
  if (mode === "forgot") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto flex max-w-md flex-col px-6 py-16">
          <Card>
            <CardContent className="p-8">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Reset your password
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your email and we'll send a reset link.
              </p>
              <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.co.uk"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading || !!success}
                    required
                  />
                </div>
                {error && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                {success && (
                  <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
                    {success}
                  </div>
                )}
                {!success && (
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? "Sending…" : "Send reset link"}
                  </Button>
                )}
              </form>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                <button
                  type="button"
                  onClick={() => navigate({ to: "/auth", search: { mode: "signin" } })}
                  className="font-medium text-accent hover:underline"
                >
                  ← Back to sign in
                </button>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Sign in / Sign up ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto flex max-w-md flex-col px-6 py-16">
        <Card>
          <CardContent className="p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Sign in to continue analysing UK refurbs."
                : "Start analysing UK refurbs in minutes."}
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    autoComplete="name"
                    placeholder="Jane Smith"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.co.uk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/auth", search: { mode: "forgot" } })}
                      className="text-xs text-muted-foreground hover:text-accent hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading || oauthLoading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading
                  ? mode === "signin"
                    ? "Signing in…"
                    : "Creating account…"
                  : mode === "signin"
                    ? "Sign in"
                    : "Create account"}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loading || oauthLoading}
              onClick={async () => {
                setError(null);
                setOauthLoading(true);
                try {
                  await auth.signInWithGoogle();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Google sign-in failed.");
                  setOauthLoading(false);
                }
              }}
            >
              {oauthLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {oauthLoading ? "Redirecting…" : "Continue with Google"}
            </Button>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={toggle}
                className="font-medium text-accent hover:underline"
                disabled={loading}
              >
                {mode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </p>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              <Link to="/" className="hover:underline">
                ← Back to home
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
