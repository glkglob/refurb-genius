// Supabase-backed auth. Keeps the same surface the app already uses
// (signIn / signUp / signOut / getUser / onChange) so consumers don't need
// to change. Google sign-in is exposed via signInWithGoogle().
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { isSupabaseConfigured } from "./supabase-config";

export type AuthUser = {
  id: string;
  email: string;
  fullName?: string;
};

type Listener = (user: AuthUser | null) => void;
const listeners = new Set<Listener>();

let currentUser: AuthUser | null = null;
let initialized = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromSupabaseUser(
  u: { id: string; email?: string | null; user_metadata?: any } | null | undefined,
): AuthUser | null {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email ?? "",
    fullName: u.user_metadata?.full_name ?? u.user_metadata?.name ?? undefined,
  };
}

function notify() {
  listeners.forEach((l) => l(currentUser));
}

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  if (!isSupabaseConfigured()) return;
  initialized = true;

  // 1. Bind the listener BEFORE getSession to avoid races.
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = fromSupabaseUser(session?.user);
    notify();
  });

  // 2. Restore any persisted session.
  supabase.auth.getSession().then(({ data }) => {
    currentUser = fromSupabaseUser(data.session?.user);
    notify();
  });
}

export const auth = {
  getUser(): AuthUser | null {
    ensureInitialized();
    return currentUser;
  },
  isAuthenticated(): boolean {
    return currentUser !== null;
  },
  async signIn(email: string, password: string): Promise<AuthUser> {
    if (!email || !password) throw new Error("Email and password are required.");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    const user = fromSupabaseUser(data.user);
    if (!user) throw new Error("Sign in failed.");
    currentUser = user;
    listeners.forEach((listener) => listener(currentUser));
    return currentUser;
  },
  async signUp(email: string, password: string, fullName: string): Promise<AuthUser> {
    if (!email || !password || !fullName) throw new Error("All fields are required.");
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");
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
    return user;
  },
  async signInWithGoogle(): Promise<void> {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth/callback",
    });
    if (result.error) throw new Error(result.error.message ?? "Google sign-in failed.");
  },
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
    currentUser = null;
    notify();
  },
  async resetPasswordForEmail(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    if (error) throw new Error(error.message);
  },
  async updatePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  },
  onChange(listener: Listener): () => void {
    ensureInitialized();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
