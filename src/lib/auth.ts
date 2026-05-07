// Mock auth helper. Structure mirrors Supabase Auth so it can be swapped later.
// Replace the implementation of these functions with Supabase calls without
// changing the consumer code.

const STORAGE_KEY = "rg.auth.user";

export type AuthUser = {
  id: string;
  email: string;
  fullName?: string;
};

type Listener = (user: AuthUser | null) => void;
const listeners = new Set<Listener>();

function read(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function write(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(STORAGE_KEY);
  listeners.forEach((l) => l(user));
}

function delay(ms = 600) {
  return new Promise((r) => setTimeout(r, ms));
}

export const auth = {
  getUser(): AuthUser | null {
    return read();
  },
  isAuthenticated(): boolean {
    return read() !== null;
  },
  async signIn(email: string, password: string): Promise<AuthUser> {
    await delay();
    if (!email || !password) throw new Error("Email and password are required.");
    if (password.length < 6) throw new Error("Incorrect email or password.");
    const user: AuthUser = { id: crypto.randomUUID(), email };
    write(user);
    return user;
  },
  async signUp(email: string, password: string, fullName: string): Promise<AuthUser> {
    await delay();
    if (!email || !password || !fullName) throw new Error("All fields are required.");
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");
    const user: AuthUser = { id: crypto.randomUUID(), email, fullName };
    write(user);
    return user;
  },
  async signOut(): Promise<void> {
    await delay(200);
    write(null);
  },
  onChange(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
