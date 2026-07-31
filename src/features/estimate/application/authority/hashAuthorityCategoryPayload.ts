/**
 * Deterministic payload hash for category authority persistence.
 *
 * Hashes only server-normalized non-money inputs + server-owned policy version.
 * Never includes caller totals, timestamps, user IDs, or random values.
 *
 * Uses Web Crypto (available in Node 20+ and modern browsers) so this module
 * is safe to include in the application barrel without pulling node:crypto.
 */
import { ESTIMATE_CATEGORIES, type EstimateCategory } from "@repo/types";
import type { SaveAuthorityCategoryEstimateCommand } from "./decodeSaveAuthorityCategoryEstimateCommand";
import {
  CATEGORY_PRICING_POLICY_VERSION,
  type CategoryPricingPolicyVersion,
} from "./authorityCommandPolicy";

export type AuthorityCategoryPayloadHashInput = {
  projectId: string;
  inputs: SaveAuthorityCategoryEstimateCommand["inputs"];
  pricingPolicyVersion: CategoryPricingPolicyVersion | string;
};

/**
 * Normalize selected categories into the canonical catalogue order.
 * Order of selection is not financially significant for category pricing.
 */
export function normalizeCategoriesForHash(
  categories: readonly EstimateCategory[],
): EstimateCategory[] {
  const set = new Set(categories);
  return ESTIMATE_CATEGORIES.filter((c) => set.has(c));
}

/**
 * Build the fixed-field-order object that is hashed.
 */
export function buildAuthorityCategoryHashObject(
  input: AuthorityCategoryPayloadHashInput,
): Record<string, unknown> {
  return {
    authorityOperation: "category-engine",
    projectId: input.projectId,
    pricingPolicyVersion: input.pricingPolicyVersion,
    inputs: {
      region: input.inputs.region,
      property_condition: input.inputs.property_condition,
      finish_quality: input.inputs.finish_quality,
      property_size_sqm: input.inputs.property_size_sqm,
      selected_categories: normalizeCategoriesForHash(input.inputs.selected_categories),
    },
  };
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * SHA-256 lowercase hex (64 chars) of the normalized category authority payload.
 */
export async function hashAuthorityCategoryPayload(
  input: AuthorityCategoryPayloadHashInput,
): Promise<string> {
  const normalized = buildAuthorityCategoryHashObject(input);
  const json = JSON.stringify(normalized);
  const data = new TextEncoder().encode(json);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(digest);
}

/**
 * Convenience: hash a decoded command with the server-owned policy version.
 */
export async function hashDecodedCategoryCommand(
  command: SaveAuthorityCategoryEstimateCommand,
  pricingPolicyVersion: string = CATEGORY_PRICING_POLICY_VERSION,
): Promise<string> {
  return hashAuthorityCategoryPayload({
    projectId: command.projectId,
    inputs: command.inputs,
    pricingPolicyVersion,
  });
}
