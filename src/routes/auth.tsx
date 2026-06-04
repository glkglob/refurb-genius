import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/services/supabase";
import { toast } from "sonner";

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
  const { mode = "signin" } = useSearch({ from: "/auth" });

  const [isSignIn, setIsSignIn] = useState(mode !== "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState("");

  // Rate limiting state
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;
  const remainingSeconds = isLocked ? Math.ceil((lockedUntil! - Date.now()) / 1000) : 0;

  // Countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isLocked) {
      interval = setInterval(() => {
        if (Date.now() >= lockedUntil!) {
          setLockedUntil(null);
          setFailedAttempts(0);
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLocked, lockedUntil]);

  // supabase client from centralized service (replaces createBrowserClient)

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
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
      } else {
        // Sign up
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });

        if (signUpError) throw signUpError;
      }

      // Success → reset rate limit
      setFailedAttempts(0);
      setLockedUntil(null);

      toast.success(isSignIn ? "Signed in successfully" : "Account created! Check your email.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      console.error(err);

      const message = err instanceof Error ? err.message : "Authentication failed";

      // Handle rate limit from Supabase
      if (
        message.toLowerCase().includes("rate limit") ||
        message.toLowerCase().includes("too many requests")
      ) {
        setError("Too many sign-in attempts. Please wait a moment and try again.");
      } else {
        setError(message);
      }

      // Increment failed attempts
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);

      if (newAttempts >= 3) {
        const lockTime = Date.now() + 60_000; // 60 seconds lockout
        setLockedUntil(lockTime);
        setError(`Too many failed attempts. Please wait 60 seconds.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setOauthLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign in failed");
    } finally {
      setOauthLoading(false);
    }
  };

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
                  required={!isSignIn}
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
              {loading ? "Processing..." : isSignIn ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <div className="mt-6">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={oauthLoading || isLocked}
            >
              {oauthLoading ? "Connecting..." : "Continue with Google"}
            </Button>
          </div>

          <div className="mt-6 text-center text-sm">
            {isSignIn ? (
              <p>
                Don't have an account?{" "}
                <button
                  onClick={() => setIsSignIn(false)}
                  className="text-blue-600 hover:underline"
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button onClick={() => setIsSignIn(true)} className="text-blue-600 hover:underline">
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
