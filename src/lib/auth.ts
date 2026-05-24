// Supabase-backed auth. Keeps the same surface the app already uses
// (signIn / signUp / signOut / getUser / onChange) so consumers don't need
// to change. Google sign-in is exposed via signInWithGoogle().
import { supabase } from "@/integrations/supabase/client";
import { captureAuthError, addDiagnosticBreadcrumb } from "./sentry";
import { logger } from "./logger";

export type AuthUser = {
  id: string;
  email: string;
  fullName?: string;
};

type Listener = (user: AuthUser | null) => void;
const listeners = new Set<Listener>();

let currentUser: AuthUser | null = null;
let initialized = false;
let initializing = false;
let sessionHydrated = false;
let authSubscription: { unsubscribe: () => void } | null = null;

/** Maximum ms to wait for Supabase session check before declaring hydrated=true.
 *  Prevents an infinite "Checking session…" spinner when Supabase is unreachable
 *  or env vars are misconfigured. After the timeout, the user is treated as
 *  unauthenticated and RequireAuth redirects to /auth normally. */
const HYDRATION_TIMEOUT_MS = 5_000;

function fromSupabaseUser(
  u:
    | { id: string; email?: string | null; user_metadata?: Record<string, unknown> }
    | null
    | undefined,
): AuthUser | null {
  if (!u) return null;
  const meta = u.user_metadata;
  const fullName =
    (typeof meta?.full_name === "string" ? meta.full_name : undefined) ??
    (typeof meta?.name === "string" ? meta.name : undefined);
  return {
    id: u.id,
    email: u.email ?? "",
    fullName,
  };
}

function notify() {
  listeners.forEach((l) => l(currentUser));
}

async function ensureInitialized(): Promise<void> {
  if (initialized || initializing || typeof window === "undefined") return;
  initializing = true;

  logger.info("[auth] ensureInitialized:start");
  addDiagnosticBreadcrumb("auth:session_check:start");

  // Safety timeout: if Supabase never responds, unblock the app after HYDRATION_TIMEOUT_MS.
  // This prevents an infinite "Checking session…" spinner on RequireAuth-guarded pages.
  const hydrationTimer = setTimeout(() => {
    if (!sessionHydrated) {
      logger.warn("[auth] hydration timeout — treating user as unauthenticated");
      sessionHydrated = true;
      initialized = true;
      initializing = false;
      currentUser = null;
      notify();
    }
  }, HYDRATION_TIMEOUT_MS);

  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      logger.error("[auth] getSession failed", { error: error.message });
      captureAuthError(error, "session_check", { code: error.code, message: error.message });
    }

    currentUser = fromSupabaseUser(session?.user);
    addDiagnosticBreadcrumb("auth:session_check:complete", {
      hasSession: Boolean(session),
      hasUser: Boolean(currentUser),
    });

    if (!authSubscription) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, newSession) => {
        currentUser = fromSupabaseUser(newSession?.user);
        sessionHydrated = true;
        logger.info("[auth] state changed", {
          hasSession: Boolean(newSession),
          hasUser: Boolean(currentUser),
          sessionHydrated,
        });
        addDiagnosticBreadcrumb("auth:state_changed", {
          event: _event,
          hasSession: Boolean(newSession),
        });
        notify();
      });
      authSubscription = subscription;
    }

    initialized = true;
  } catch (err) {
    logger.error("[auth] ensureInitialized failed", { error: String(err) });
    captureAuthError(err, "session_check", { fatal: true });
    currentUser = null;
    initialized = true;
  } finally {
    clearTimeout(hydrationTimer);
    sessionHydrated = true;
    initializing = false;
    logger.info("[auth] ensureInitialized:hydrated", {
      hasUser: Boolean(currentUser),
      sessionHydrated,
    });
    notify();
  }
}

export const auth = {
  getUser(): AuthUser | null {
    void ensureInitialized();
    return currentUser;
  },
  isHydrated(): boolean {
    void ensureInitialized();
    return sessionHydrated;
  },
  isAuthenticated(): boolean {
    return currentUser !== null;
  },
  async signIn(email: string, password: string): Promise<AuthUser> {
    if (!email || !password) throw new Error("Email and password are required.");
    try {
      addDiagnosticBreadcrumb("auth:sign_in:attempt", { email });
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      const user = fromSupabaseUser(data.user);
      if (!user) throw new Error("Sign in failed.");
      currentUser = user;
      addDiagnosticBreadcrumb("auth:sign_in:success", { userId: user.id });
      listeners.forEach((listener) => listener(currentUser));
      return currentUser;
    } catch (err) {
      logger.error("[auth] signIn failed", { email, error: String(err) });
      captureAuthError(err, "login", { email });
      throw err;
    }
  },
  async signUp(email: string, password: string, fullName: string): Promise<AuthUser> {
    if (!email || !password || !fullName) throw new Error("All fields are required.");
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");
    try {
      addDiagnosticBreadcrumb("auth:sign_up:attempt", { email });
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw new Error(error.message);
      const user = fromSupabaseUser(data.user);
      if (!user) throw new Error("Sign up failed.");
      addDiagnosticBreadcrumb("auth:sign_up:success", { userId: user.id });
      return user;
    } catch (err) {
      logger.error("[auth] signUp failed", { email, error: String(err) });
      captureAuthError(err, "signup", { email });
      throw err;
    }
  },
  async signInWithGoogle(): Promise<void> {
    try {
      addDiagnosticBreadcrumb("auth:google_signin:attempt");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/auth/callback",
        },
      });
      if (error) throw new Error(error.message ?? "Google sign-in failed.");
      addDiagnosticBreadcrumb("auth:google_signin:success");
    } catch (err) {
      logger.error("[auth] signInWithGoogle failed", { error: String(err) });
      captureAuthError(err, "google_signin");
      throw err;
    }
  },
  async signOut(): Promise<void> {
    try {
      addDiagnosticBreadcrumb("auth:sign_out:attempt");
      await supabase.auth.signOut();
      currentUser = null;
      addDiagnosticBreadcrumb("auth:sign_out:success");
      notify();
    } catch (err) {
      logger.error("[auth] signOut failed", { error: String(err) });
      captureAuthError(err, "logout");
      throw err;
    }
  },
  async resetPasswordForEmail(email: string): Promise<void> {
    try {
      addDiagnosticBreadcrumb("auth:reset_password:attempt", { email });
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      });
      if (error) throw new Error(error.message);
      addDiagnosticBreadcrumb("auth:reset_password:success", { email });
    } catch (err) {
      logger.error("[auth] resetPasswordForEmail failed", { email, error: String(err) });
      captureAuthError(err, "token_refresh", { email });
      throw err;
    }
  },
  async updatePassword(password: string): Promise<void> {
    try {
      addDiagnosticBreadcrumb("auth:update_password:attempt");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
      addDiagnosticBreadcrumb("auth:update_password:success");
    } catch (err) {
      logger.error("[auth] updatePassword failed", { error: String(err) });
      captureAuthError(err, "token_refresh");
      throw err;
    }
  },
  onChange(listener: Listener): () => void {
    void ensureInitialized();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
