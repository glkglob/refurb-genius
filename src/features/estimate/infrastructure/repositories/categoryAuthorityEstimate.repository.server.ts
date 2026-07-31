/**
 * Server-only persistence adapter for category-engine authority estimates.
 *
 * Uses the platform service-role client. Must never be imported from browser
 * barrels or client-reachable modules. Invoke only via dynamic import() inside
 * createServerFn handlers.
 */
import type { Json } from "@repo/supabase";
import type { PricingEngineResult } from "../../domain";
import { AuthorityError } from "../../application/authority/authorityErrors";

type ServiceClient = Awaited<
  ReturnType<typeof import("@/platform/supabase/service.server").createServiceRoleSupabase>
>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SupabaseRpcError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

async function getServiceClient(): Promise<ServiceClient> {
  const { createServiceRoleSupabase } = await import("@/platform/supabase/service.server");
  try {
    return createServiceRoleSupabase();
  } catch {
    throw new AuthorityError(
      "AUTHORITY_PERSISTENCE_FAILED",
      "Category authority persistence is not configured on the server.",
    );
  }
}

/**
 * Map PostgREST / Postgres errors to structured AuthorityError.
 * Prefer SQLSTATE codes; message matching is fallback only.
 */
export function mapRpcError(error: SupabaseRpcError | string): AuthorityError {
  const message = typeof error === "string" ? error : (error.message ?? "");
  const code = typeof error === "string" ? "" : (error.code ?? "");
  const upper = message.toUpperCase();

  // Prefer code + message for unique_violation → only IDEMPOTENCY_CONFLICT
  // is intentionally raised as 23505 from this RPC.
  if (
    (code === "23505" && upper.includes("IDEMPOTENCY_CONFLICT")) ||
    upper.includes("IDEMPOTENCY_CONFLICT")
  ) {
    return new AuthorityError(
      "IDEMPOTENCY_CONFLICT",
      "Idempotency key reused with a different payload.",
    );
  }
  if (code === "P0002" || upper.includes("PROJECT_NOT_FOUND")) {
    return new AuthorityError("PROJECT_NOT_FOUND", "Project not found.");
  }
  if (code === "P0001" || upper.includes("PROJECT_OWNERSHIP_CHANGED")) {
    return new AuthorityError(
      "PROJECT_OWNERSHIP_CHANGED",
      "Project ownership does not match the authenticated user.",
    );
  }
  if (code === "22023" || upper.includes("INVALID_AUTHORITY_FIELD_VALUE")) {
    return new AuthorityError(
      "INVALID_AUTHORITY_FIELD_VALUE",
      "Authority persistence rejected invalid field values.",
    );
  }
  return new AuthorityError(
    "AUTHORITY_PERSISTENCE_FAILED",
    "Failed to persist category authority estimate.",
  );
}

function parseRpcResponse(data: unknown): {
  estimateId: string;
  replay: boolean;
  estimate: Record<string, unknown>;
  items: Record<string, unknown>[];
} {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new AuthorityError(
      "AUTHORITY_PERSISTENCE_FAILED",
      "Empty response from category authority persistence.",
    );
  }
  const payload = data as Record<string, unknown>;
  const estimateId = payload.estimate_id;
  const replay = payload.replay;
  const estimate = payload.estimate;
  const items = payload.items;

  if (typeof estimateId !== "string" || !UUID_RE.test(estimateId)) {
    throw new AuthorityError(
      "AUTHORITY_PERSISTENCE_FAILED",
      "Malformed response from category authority persistence.",
    );
  }
  if (typeof replay !== "boolean") {
    throw new AuthorityError(
      "AUTHORITY_PERSISTENCE_FAILED",
      "Malformed response from category authority persistence.",
    );
  }
  if (!estimate || typeof estimate !== "object" || Array.isArray(estimate)) {
    throw new AuthorityError(
      "AUTHORITY_PERSISTENCE_FAILED",
      "Malformed response from category authority persistence.",
    );
  }
  if (
    !Array.isArray(items) ||
    !items.every((i) => i && typeof i === "object" && !Array.isArray(i))
  ) {
    throw new AuthorityError(
      "AUTHORITY_PERSISTENCE_FAILED",
      "Malformed response from category authority persistence.",
    );
  }

  return {
    estimateId,
    replay,
    estimate: estimate as Record<string, unknown>,
    items: items as Record<string, unknown>[],
  };
}

export type PersistCategoryEngineEstimateInput = {
  projectId: string;
  expectedOwnerId: string;
  idempotencyKey: string;
  payloadHash: string;
  pricingPolicyVersion: string;
  pricing: PricingEngineResult;
};

export type PersistCategoryEngineEstimateResult = {
  estimateId: string;
  replay: boolean;
  estimate: Record<string, unknown>;
  items: Record<string, unknown>[];
};

/**
 * Invoke private RPC public.persist_category_engine_estimate.
 */
export async function persistCategoryEngineEstimate(
  input: PersistCategoryEngineEstimateInput,
  client?: ServiceClient,
): Promise<PersistCategoryEngineEstimateResult> {
  const supabase = client ?? (await getServiceClient());

  // Guard non-finite engine outputs before RPC (engine clamps size; still verify).
  const moneyFields = [
    input.pricing.labour_total,
    input.pricing.materials_total,
    input.pricing.subtotal,
    input.pricing.contingency,
    input.pricing.vat,
    input.pricing.low_total,
    input.pricing.mid_total,
    input.pricing.high_total,
    input.pricing.timeline_weeks,
  ];
  if (moneyFields.some((n) => typeof n !== "number" || !Number.isFinite(n) || n < 0)) {
    throw new AuthorityError(
      "AUTHORITY_PERSISTENCE_FAILED",
      "Pricing engine produced non-persistable results.",
    );
  }

  const items = input.pricing.lineItems.map((item) => ({
    category: item.category,
    labour: item.labour,
    materials: item.materials,
    total: item.total,
    weeks: item.weeks,
  }));

  const { data, error } = await supabase.rpc("persist_category_engine_estimate", {
    p_project_id: input.projectId,
    p_expected_owner_id: input.expectedOwnerId,
    p_idempotency_key: input.idempotencyKey,
    p_payload_hash: input.payloadHash,
    p_pricing_policy_version: input.pricingPolicyVersion,
    p_region: input.pricing.inputs.region,
    p_condition_level: input.pricing.inputs.property_condition,
    p_finish_level: input.pricing.inputs.finish_quality,
    p_labour_total: input.pricing.labour_total,
    p_materials_total: input.pricing.materials_total,
    p_subtotal: input.pricing.subtotal,
    p_contingency: input.pricing.contingency,
    p_vat_amount: input.pricing.vat,
    p_low_total: input.pricing.low_total,
    p_mid_total: input.pricing.mid_total,
    p_high_total: input.pricing.high_total,
    p_timeline_weeks: input.pricing.timeline_weeks,
    p_items: items as unknown as Json,
  });

  if (error) {
    throw mapRpcError(error);
  }

  return parseRpcResponse(data);
}

/**
 * Initial ownership check (pre-RPC). Uses service role for a reliable read.
 */
export async function assertProjectOwnedBy(
  projectId: string,
  expectedOwnerId: string,
  client?: ServiceClient,
): Promise<void> {
  const supabase = client ?? (await getServiceClient());
  const { data, error } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw new AuthorityError("AUTHORITY_PERSISTENCE_FAILED", "Failed to verify project ownership.");
  }
  if (!data) {
    throw new AuthorityError("PROJECT_NOT_FOUND", "Project not found.");
  }
  if (data.user_id !== expectedOwnerId) {
    throw new AuthorityError(
      "PROJECT_OWNERSHIP_CHANGED",
      "Project ownership does not match the authenticated user.",
    );
  }
}
