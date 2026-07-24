/**
 * Shared types for the data architecture registry (Phase 4–5).
 * Registration + integrity ratchets only — no runtime or RLS changes.
 */

export type DataMaturity = "live" | "partial" | "transitional" | "reserved" | "legacy";

export type DataEnforcement = "enforced" | "documented" | "transitional" | "partial" | "planned";

export type TenantScope =
  | "authenticated-user"
  | "admin-elevated"
  | "public"
  | "system"
  | "party-scoped"
  | "shared-reference"
  | "mixed"
  /** Unsupported in current schema — must not appear on live domains */
  | "organisation"
  | "none";

export const RECOGNIZED_TENANT_SCOPES: readonly TenantScope[] = [
  "authenticated-user",
  "admin-elevated",
  "public",
  "system",
  "party-scoped",
  "shared-reference",
  "mixed",
  "organisation",
  "none",
] as const;

/** How durable the domain's data is */
export type PersistenceKind = "persistent" | "derived" | "ephemeral" | "external" | "system-owned";

export type ProductOwnerLabel =
  | "refurb-genius"
  | "deal-copilot"
  | "refurb-iq"
  | "shared-platform"
  | "marketplace"
  | "mixed";

/** Explicit authority flags for services / persistence surfaces */
export type AuthorityFlags = {
  mayRead: boolean;
  mayWrite: boolean;
  ownsDurableState: boolean;
  derivesValues: boolean;
  orchestrates: boolean;
  externalProviderIo: boolean;
};
