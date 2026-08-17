export {
  makeCreateEstimate,
  type CreateEstimateCommand,
  type CreateEstimateDeps,
  type CreateEstimateResult,
} from "./createEstimate";
export type { EstimateRepository, SavedEstimateRef } from "./ports";
export {
  makeEstimateService,
  type EstimateService,
  type EstimateServiceDeps,
} from "./estimateService";
export {
  buildEstimateBuilderSaveInput,
  type BuildEstimateBuilderSaveInputParams,
  type EstimateBuilderSaveRoom,
} from "./buildEstimateBuilderSaveInput";
export {
  buildAIEstimateBuilderSaveInput,
  type BuildAIEstimateBuilderSaveInputParams,
  type AIEstimateBuilderSaveRoom,
  type AIEstimateBuilderSaveItem,
} from "./buildAIEstimateBuilderSaveInput";

/** Advisory ConditionLevel comparison — Quick estimate, non-persisting. */
export { compareConditionLevels, type ConditionLevelCompareRow } from "./compareConditionLevels";

/** L1 progressive estimate — pure engine path, non-persisting. */
export { runL1Estimate, type L1EstimateResult } from "./runL1Estimate";

/** L2 progressive estimate — finish/size/categories refinement, non-persisting. */
export { runL2Estimate, type L2EstimateResult } from "./runL2Estimate";

/** L3 measured-BOQ reprice — pure engine path, non-persisting. */
export {
  repriceMeasuredBoq,
  type RepriceMeasuredBoqResult,
  type RepriceMeasuredBoqDependencies,
} from "./repriceMeasuredBoq";

/**
 * L3 category authority command surface (pure decoder/policy/use-case factories).
 * Server-only persistence adapters are NOT exported here — dynamic import only.
 */
export {
  MAX_AUTHORITY_REQUEST_BYTES,
  MAX_ROOMS,
  MAX_ITEMS_PER_ROOM,
  MAX_TOTAL_ITEMS,
  MAX_IDENTIFIER_LENGTH,
  MAX_IDEMPOTENCY_KEY_LENGTH,
  MAX_NAME_LENGTH,
  MAX_CATEGORY_LENGTH,
  MAX_UNIT_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_RATE_KEY_LENGTH,
  MAX_CATALOG_REVISION_LENGTH,
  CATEGORY_PRICING_POLICY_VERSION,
  AuthorityError,
  isAuthorityError,
  isRetryableAuthorityCode,
  decodeSaveAuthorityCategoryEstimateCommand,
  measureAuthorityRequestBytes,
  hashAuthorityCategoryPayload,
  hashDecodedCategoryCommand,
  makeSaveAuthorityCategoryEstimate,
  executeAuthorityCategorySave,
  type CategoryPricingPolicyVersion,
  type AuthorityErrorCode,
  type SaveAuthorityCategoryEstimateCommand,
  type SaveAuthorityCategoryEstimateDeps,
  type AuthorityCategoryPersistedEstimate,
  type AuthorityCategoryPersistencePort,
  type ProjectOwnershipPort,
  type AuthenticatedSessionPort,
  type ExecuteAuthorityCategorySaveDeps,
  type AuthoritySaveResponse,
  type AuthoritySaveSuccessData,
} from "./authority";

/**
 * Pure catalogue validation / mixed-revision gate (no IO).
 * Server-only catalogue loaders are NOT exported here.
 */
export {
  assertSingleCatalogRevision,
  validateCatalogueSnapshot,
  computeCatalogueContentChecksum,
  MAX_CATALOG_ENTRIES,
  CANONICAL_MEASURED_BOQ_UNITS,
  MEASURED_BOQ_COST_TYPES,
  type MixedCatalogRevisionResult,
  type MeasuredBoqCatalogueSourceSnapshot,
  type CatalogueValidationResult,
} from "./catalogue";
