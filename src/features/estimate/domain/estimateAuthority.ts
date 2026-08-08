/**
 * IA-5 — Estimate authority classification (pure).
 *
 * Mirrors SQL helper ia5_is_authoritative_estimate_pricing:
 * authoritative pricing markers only (category-engine | measured-boq-engine).
 * Does not write pricing_authority; browser inserts remain authority-none.
 */

const AUTHORITATIVE_PRICING = new Set(["category-engine", "measured-boq-engine"]);

export function isAuthoritativePricingAuthority(
  pricingAuthority: string | null | undefined,
): boolean {
  return AUTHORITATIVE_PRICING.has(pricingAuthority ?? "none");
}

export type EstimateAuthorityRowLike = {
  id: string;
  pricing_authority: string | null;
  input_scope_id: string | null;
  created_at: string;
};

/**
 * Latest authoritative Estimate bound to currentScopeId (CASE A ordering).
 * Drafts and stale-Scope rows never win.
 */
export function selectCurrentAuthorityEstimateRow<T extends EstimateAuthorityRowLike>(
  rows: T[],
  currentScopeId: string | null | undefined,
): T | null {
  if (!currentScopeId || rows.length === 0) return null;
  const qualified = rows
    .filter(
      (e) =>
        isAuthoritativePricingAuthority(e.pricing_authority) &&
        e.input_scope_id != null &&
        e.input_scope_id === currentScopeId,
    )
    .sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      if (tb !== ta) return tb - ta;
      return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
    });
  return qualified[0] ?? null;
}
