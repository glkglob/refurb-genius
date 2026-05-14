// TODO: Remove builder-only guard before beta launch

/** Emails permitted to access protected routes during private development. */
export const ALLOWED_EMAILS: readonly string[] = ["kris.solo@rissololtd.co.uk"];

export function isAllowedBuilder(email?: string | null): boolean {
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.toLowerCase().trim());
}
