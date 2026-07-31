/**
 * Application use case: save an authority-priced category estimate.
 *
 * Order:
 * 1. receive already-decoded command
 * 2. authenticate (session)
 * 3. derive expectedOwnerId from session
 * 4. initial project ownership verification
 * 5. runPricingEngine on the server
 * 6. server-owned policy version
 * 7. deterministic payload hash
 * 8. private persistence adapter / RPC
 * 9. return persisted estimate + items
 *
 * Never accepts user ID from the command.
 */
import { runPricingEngine, type PricingEngineResult } from "../../domain";
import { CATEGORY_PRICING_POLICY_VERSION } from "./authorityCommandPolicy";
import { AuthorityError } from "./authorityErrors";
import type { SaveAuthorityCategoryEstimateCommand } from "./decodeSaveAuthorityCategoryEstimateCommand";
import { hashDecodedCategoryCommand } from "./hashAuthorityCategoryPayload";

export type AuthorityCategoryPersistedEstimate = {
  estimateId: string;
  replay: boolean;
  estimate: Record<string, unknown>;
  items: Record<string, unknown>[];
  pricing: PricingEngineResult;
};

export type AuthorityCategoryPersistencePort = {
  persistCategoryEngineEstimate(input: {
    projectId: string;
    expectedOwnerId: string;
    idempotencyKey: string;
    payloadHash: string;
    pricingPolicyVersion: string;
    pricing: PricingEngineResult;
  }): Promise<{
    estimateId: string;
    replay: boolean;
    estimate: Record<string, unknown>;
    items: Record<string, unknown>[];
  }>;
};

export type ProjectOwnershipPort = {
  /**
   * Verify the project exists and is owned by expectedOwnerId.
   * @throws AuthorityError PROJECT_NOT_FOUND | PROJECT_OWNERSHIP_CHANGED
   */
  assertProjectOwnedBy(projectId: string, expectedOwnerId: string): Promise<void>;
};

export type AuthenticatedSessionPort = {
  /** Resolve the authenticated user from the server session. */
  requireUserId(): Promise<string>;
};

export type SaveAuthorityCategoryEstimateDeps = {
  auth: AuthenticatedSessionPort;
  projects: ProjectOwnershipPort;
  persistence: AuthorityCategoryPersistencePort;
  /** Optional injection for tests; defaults to domain runPricingEngine. */
  price?: (inputs: SaveAuthorityCategoryEstimateCommand["inputs"]) => PricingEngineResult;
};

export function makeSaveAuthorityCategoryEstimate(deps: SaveAuthorityCategoryEstimateDeps) {
  const price = deps.price ?? runPricingEngine;

  return async function saveAuthorityCategoryEstimate(
    command: SaveAuthorityCategoryEstimateCommand,
  ): Promise<AuthorityCategoryPersistedEstimate> {
    const expectedOwnerId = await deps.auth.requireUserId();

    await deps.projects.assertProjectOwnedBy(command.projectId, expectedOwnerId);

    const pricing = price(command.inputs);
    const pricingPolicyVersion = CATEGORY_PRICING_POLICY_VERSION;
    const payloadHash = await hashDecodedCategoryCommand(command, pricingPolicyVersion);

    const persisted = await deps.persistence.persistCategoryEngineEstimate({
      projectId: command.projectId,
      expectedOwnerId,
      idempotencyKey: command.idempotencyKey,
      payloadHash,
      pricingPolicyVersion,
      pricing,
    });

    return {
      estimateId: persisted.estimateId,
      replay: persisted.replay,
      estimate: persisted.estimate,
      items: persisted.items,
      pricing,
    };
  };
}

export { AuthorityError };
