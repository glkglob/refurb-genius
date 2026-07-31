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
  type CategoryPricingPolicyVersion,
} from "./authorityCommandPolicy";

export {
  AuthorityError,
  isAuthorityError,
  isRetryableAuthorityCode,
  type AuthorityErrorCode,
} from "./authorityErrors";

export {
  decodeSaveAuthorityCategoryEstimateCommand,
  measureAuthorityRequestBytes,
  type SaveAuthorityCategoryEstimateCommand,
} from "./decodeSaveAuthorityCategoryEstimateCommand";

export {
  hashAuthorityCategoryPayload,
  hashDecodedCategoryCommand,
  buildAuthorityCategoryHashObject,
  normalizeCategoriesForHash,
  type AuthorityCategoryPayloadHashInput,
} from "./hashAuthorityCategoryPayload";

export {
  makeSaveAuthorityCategoryEstimate,
  type SaveAuthorityCategoryEstimateDeps,
  type AuthorityCategoryPersistedEstimate,
  type AuthorityCategoryPersistencePort,
  type ProjectOwnershipPort,
  type AuthenticatedSessionPort,
} from "./saveAuthorityCategoryEstimate";

export {
  executeAuthorityCategorySave,
  type ExecuteAuthorityCategorySaveDeps,
  type AuthoritySaveResponse,
  type AuthoritySaveSuccessData,
} from "./executeAuthorityCategorySave";
