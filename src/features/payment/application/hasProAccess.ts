import type { AuthUser } from "@/lib/auth";

const PRO_EMAIL_DOMAINS = ["@refurbgenius.internal", "@glkglob.com"];

export function hasProAccess(user: Pick<AuthUser, "email"> | null | undefined): boolean {
  if (!user?.email) return false;

  if (import.meta.env.VITE_ENABLE_PRO_FEATURES === "true") {
    return true;
  }

  return PRO_EMAIL_DOMAINS.some((domain) => user.email.toLowerCase().endsWith(domain));
}
