/**
 * Browser sign-out Auth primitive (AO-1S1).
 *
 * Thin delegation to frozen lib/auth.signOut so listener notification,
 * breadcrumbs, logging, and Sentry capture remain unchanged.
 * Presentation-free (no React, routing, product cache, or UI side effects).
 */
import { auth } from "@/lib/auth";

/** End the current browser session. Caller owns routing and UI. */
export async function signOutSession(): Promise<void> {
  await auth.signOut();
}
