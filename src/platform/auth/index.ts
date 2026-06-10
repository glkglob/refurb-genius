import { auth, type AuthUser } from "@/lib/auth";

export interface AuthProvider {
  getUser(): AuthUser | null;
  isHydrated(): boolean;
  isAuthenticated(): boolean;
  signOut(): Promise<void>;
}

export const createAuthProvider = (): AuthProvider => ({
  getUser: auth.getUser,
  isHydrated: auth.isHydrated,
  isAuthenticated: auth.isAuthenticated,
  signOut: auth.signOut,
});
