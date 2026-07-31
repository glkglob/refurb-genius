/**
 * Strict runtime decoder for the category authority save command.
 *
 * Accepts `unknown`. Uses an explicit allowlist. Rejects (does not strip)
 * unknown or forbidden properties. Must run before authentication.
 */
import {
  CONDITION_LEVELS,
  ESTIMATE_CATEGORIES,
  FINISH_LEVELS,
  UK_REGIONS,
  type ConditionLevel,
  type EstimateCategory,
  type FinishLevel,
  type UKRegion,
} from "@repo/types";
import { MAX_AUTHORITY_REQUEST_BYTES, MAX_IDEMPOTENCY_KEY_LENGTH } from "./authorityCommandPolicy";
import { AuthorityError } from "./authorityErrors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_TOP_LEVEL = new Set(["projectId", "inputs", "idempotencyKey"]);
const ALLOWED_INPUTS = new Set([
  "region",
  "property_condition",
  "finish_quality",
  "selected_categories",
  "property_size_sqm",
]);

/** Money / authority / identity fields that must never appear at any level. */
const FORBIDDEN_FIELDS = new Set([
  "subtotal",
  "contingency",
  "vat",
  "vatAmount",
  "vat_amount",
  "vatRate",
  "vat_rate",
  "lowTotal",
  "low_total",
  "midTotal",
  "mid_total",
  "highTotal",
  "high_total",
  "total",
  "totalCost",
  "total_cost",
  "lineItems",
  "labour",
  "materials",
  "unitRate",
  "unit_rate",
  "pricingAuthority",
  "pricing_authority",
  "pricing_policy_version",
  "pricingPolicyVersion",
  "catalogRevision",
  "catalog_revision",
  "userId",
  "user_id",
  "expectedOwnerId",
  "expected_owner_id",
  "estimateDone",
  "estimate_done",
  "estimatedGdv",
  "estimated_gdv",
  "resolver",
  "pricing",
  "result",
  "engineResult",
  "labour_total",
  "materials_total",
  "timeline_weeks",
  "timelineWeeks",
]);

export type SaveAuthorityCategoryEstimateCommand = {
  projectId: string;
  inputs: {
    region: UKRegion;
    property_condition: ConditionLevel;
    finish_quality: FinishLevel;
    selected_categories: EstimateCategory[];
    property_size_sqm: number;
  };
  idempotencyKey: string;
};

function rejectForbiddenKeys(obj: Record<string, unknown>, path: string): void {
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_FIELDS.has(key)) {
      throw new AuthorityError(
        "FORBIDDEN_AUTHORITY_FIELD",
        `Forbidden field '${path}${key}' is not allowed on authority category commands.`,
        `${path}${key}`,
      );
    }
  }
}

function assertObject(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new AuthorityError("INVALID_AUTHORITY_COMMAND", `Expected object at '${field}'.`, field);
  }
  return value as Record<string, unknown>;
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new AuthorityError(
      "INVALID_AUTHORITY_FIELD_TYPE",
      `Field '${field}' must be a string.`,
      field,
    );
  }
  return value;
}

function assertExactMember<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new AuthorityError(
      "INVALID_AUTHORITY_FIELD_VALUE",
      `Field '${field}' must be one of the allowed enum values.`,
      field,
    );
  }
  return value as T;
}

/**
 * Measure UTF-8 byte length of a JSON-serializable value (decoded form).
 */
export function measureAuthorityRequestBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/**
 * Decode and validate an untrusted category authority save command.
 *
 * @throws AuthorityError before any auth / engine / persistence side effects
 */
export function decodeSaveAuthorityCategoryEstimateCommand(
  value: unknown,
): SaveAuthorityCategoryEstimateCommand {
  if (value === null || value === undefined) {
    throw new AuthorityError("INVALID_AUTHORITY_COMMAND", "Command must be a non-null object.");
  }
  if (Array.isArray(value)) {
    throw new AuthorityError("INVALID_AUTHORITY_COMMAND", "Command must not be an array.");
  }
  if (typeof value !== "object") {
    throw new AuthorityError("INVALID_AUTHORITY_COMMAND", "Command must be an object.");
  }

  const bytes = measureAuthorityRequestBytes(value);
  if (bytes > MAX_AUTHORITY_REQUEST_BYTES) {
    throw new AuthorityError(
      "AUTHORITY_REQUEST_TOO_LARGE",
      `Authority request exceeds ${MAX_AUTHORITY_REQUEST_BYTES} bytes.`,
    );
  }

  const root = value as Record<string, unknown>;
  rejectForbiddenKeys(root, "");

  for (const key of Object.keys(root)) {
    if (!ALLOWED_TOP_LEVEL.has(key)) {
      throw new AuthorityError(
        "FORBIDDEN_AUTHORITY_FIELD",
        `Unknown top-level field '${key}' is not allowed.`,
        key,
      );
    }
  }

  if (!("projectId" in root) || !("inputs" in root) || !("idempotencyKey" in root)) {
    throw new AuthorityError(
      "INVALID_AUTHORITY_COMMAND",
      "Command requires projectId, inputs, and idempotencyKey.",
    );
  }

  const projectId = assertString(root.projectId, "projectId").trim();
  if (!projectId || !UUID_RE.test(projectId)) {
    throw new AuthorityError(
      "INVALID_AUTHORITY_FIELD_VALUE",
      "projectId must be a valid non-empty UUID.",
      "projectId",
    );
  }

  const idempotencyKey = assertString(root.idempotencyKey, "idempotencyKey");
  if (idempotencyKey.length === 0 || idempotencyKey.trim().length === 0) {
    throw new AuthorityError(
      "INVALID_AUTHORITY_FIELD_VALUE",
      "idempotencyKey must be non-empty.",
      "idempotencyKey",
    );
  }
  if (idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new AuthorityError(
      "FIELD_TOO_LONG",
      `idempotencyKey must be ≤ ${MAX_IDEMPOTENCY_KEY_LENGTH} characters.`,
      "idempotencyKey",
    );
  }

  const inputsRaw = assertObject(root.inputs, "inputs");
  rejectForbiddenKeys(inputsRaw, "inputs.");

  for (const key of Object.keys(inputsRaw)) {
    if (!ALLOWED_INPUTS.has(key)) {
      throw new AuthorityError(
        "FORBIDDEN_AUTHORITY_FIELD",
        `Unknown inputs field '${key}' is not allowed.`,
        `inputs.${key}`,
      );
    }
  }

  for (const required of ALLOWED_INPUTS) {
    if (!(required in inputsRaw)) {
      throw new AuthorityError(
        "INVALID_AUTHORITY_COMMAND",
        `inputs.${required} is required.`,
        `inputs.${required}`,
      );
    }
  }

  const region = assertExactMember(inputsRaw.region, UK_REGIONS, "inputs.region");
  const property_condition = assertExactMember(
    inputsRaw.property_condition,
    CONDITION_LEVELS,
    "inputs.property_condition",
  );
  const finish_quality = assertExactMember(
    inputsRaw.finish_quality,
    FINISH_LEVELS,
    "inputs.finish_quality",
  );

  const categoriesRaw = inputsRaw.selected_categories;
  if (!Array.isArray(categoriesRaw)) {
    throw new AuthorityError(
      "INVALID_AUTHORITY_FIELD_TYPE",
      "inputs.selected_categories must be an array.",
      "inputs.selected_categories",
    );
  }
  if (categoriesRaw.length === 0) {
    throw new AuthorityError(
      "INVALID_AUTHORITY_FIELD_VALUE",
      "inputs.selected_categories must be non-empty.",
      "inputs.selected_categories",
    );
  }
  if (categoriesRaw.length > ESTIMATE_CATEGORIES.length) {
    throw new AuthorityError(
      "INVALID_AUTHORITY_FIELD_VALUE",
      "inputs.selected_categories exceeds the canonical category list.",
      "inputs.selected_categories",
    );
  }

  const selected_categories: EstimateCategory[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < categoriesRaw.length; i++) {
    const cat = categoriesRaw[i];
    const field = `inputs.selected_categories[${i}]`;
    if (typeof cat !== "string" || !(ESTIMATE_CATEGORIES as readonly string[]).includes(cat)) {
      throw new AuthorityError(
        "INVALID_AUTHORITY_FIELD_VALUE",
        `Unknown or invalid category at ${field}.`,
        field,
      );
    }
    if (seen.has(cat)) {
      throw new AuthorityError(
        "INVALID_AUTHORITY_FIELD_VALUE",
        "inputs.selected_categories must not contain duplicates.",
        field,
      );
    }
    seen.add(cat);
    selected_categories.push(cat as EstimateCategory);
  }

  const size = inputsRaw.property_size_sqm;
  if (typeof size !== "number" || !Number.isFinite(size)) {
    throw new AuthorityError(
      "INVALID_AUTHORITY_FIELD_VALUE",
      "inputs.property_size_sqm must be a finite number.",
      "inputs.property_size_sqm",
    );
  }
  if (size <= 0) {
    throw new AuthorityError(
      "INVALID_AUTHORITY_FIELD_VALUE",
      "inputs.property_size_sqm must be greater than zero.",
      "inputs.property_size_sqm",
    );
  }

  return {
    projectId,
    inputs: {
      region,
      property_condition,
      finish_quality,
      selected_categories,
      property_size_sqm: size,
    },
    idempotencyKey,
  };
}
