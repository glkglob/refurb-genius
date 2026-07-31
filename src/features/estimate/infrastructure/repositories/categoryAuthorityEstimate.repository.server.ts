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

function mapRpcError(message: string): AuthorityError {
  const upper = message.toUpperCase();
  if (upper.includes("IDEMPOTENCY_CONFLICT")) {
    return new AuthorityError(
      "IDEMPOTENCY_CONFLICT",
      "Idempotency key reused with a different payload.",
    );
  }
  if (upper.includes("PROJECT_NOT_FOUND")) {
    return new AuthorityError("PROJECT_NOT_FOUND", "Project not found.");
  }
  if (upper.includes("PROJECT_OWNERSHIP_CHANGED")) {
    return new AuthorityError(
      "PROJECT_OWNERSHIP_CHANGED",
      "Project ownership does not match the authenticated user.",
    );
  }
  return new AuthorityError(
    "AUTHORITY_PERSISTENCE_FAILED",
    "Failed to persist category authority estimate.",
  );
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
    throw mapRpcError(error.message);
  }

  if (!data || typeof data !== "object") {
    throw new AuthorityError(
      "AUTHORITY_PERSISTENCE_FAILED",
      "Empty response from category authority persistence.",
    );
  }

  const payload = data as {
    estimate_id?: string;
    replay?: boolean;
    estimate?: Record<string, unknown>;
    items?: Record<string, unknown>[];
  };

  if (!payload.estimate_id || !payload.estimate) {
    throw new AuthorityError(
      "AUTHORITY_PERSISTENCE_FAILED",
      "Malformed response from category authority persistence.",
    );
  }

  return {
    estimateId: payload.estimate_id,
    replay: Boolean(payload.replay),
    estimate: payload.estimate,
    items: Array.isArray(payload.items) ? payload.items : [],
  };
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
