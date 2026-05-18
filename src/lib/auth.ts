import { supabase } from "@/integrations/supabase/client";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string | null;
};

type AuthChangeCallback = (user: AuthUser | null) => void;

let currentUser: AuthUser | null = null;
let hydrated = false;
const listeners = new Set<AuthChangeCallback>();

function notify(user: AuthUser | null) {
  currentUser = user;
  listeners.forEach((cb) => cb(user));
}

function userFromSupabase(
  supabaseUser: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  } | null,
): AuthUser | null {
  if (!supabaseUser) return null;
  return {
    id: supabaseUser.id,
    email:
      supabaseUser.email ??
      (supabaseUser.user_metadata?.["email"] as string | undefined) ??
      "",
    fullName:
      (supabaseUser.user_metadata?.["full_name"] as string | undefined) ??
      (supabaseUser.user_metadata?.["name"] as string | undefined) ??
      null,
  };
}

// Initialise: resolve the current session then start listening for changes.
if (typeof window !== "undefined") {
  supabase.auth.getSession().then(({ data }) => {
    const user = userFromSupabase(data.session?.user ?? null);
    currentUser = user;
    hydrated = true;
    listeners.forEach((cb) => cb(user));
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    const user = userFromSupabase(session?.user ?? null);
    hydrated = true;
    notify(user);
  });
}

export const auth = {
  getUser(): AuthUser | null {
    return currentUser;
  },

  isHydrated(): boolean {
    return hydrated;
  },

  onChange(callback: AuthChangeCallback): () => void {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  },

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  },

  async signUp(email: string, password: string, fullName: string): Promise<void> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw new Error(error.message);
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  },

  async resetPasswordForEmail(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?mode=reset`,
    });
    if (error) throw new Error(error.message);
  },

  async updatePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  },

  async signInWithGoogle(): Promise<void> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw new Error(error.message);
  },
};
