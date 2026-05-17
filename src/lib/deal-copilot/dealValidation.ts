import type { ConditionLevel, ParsedDealFormData, UKRegion } from "@repo/types";

/**
 * Parse currency string to number with strict validation.
 * Rejects: negative values, multiple decimals, empty strings, non-numeric characters.
 * Returns undefined if invalid.
 */
export function parseMoney(value: string): number | undefined {
  const trimmed = value.trim();

  // Reject empty strings
  if (!trimmed) {
    return undefined;
  }

  // Validate against allowed currency pattern before parsing.
  // Allowed: optional £ or $ prefix, digits, optional commas, optional single decimal point with digits.
  // Examples: "1000", "1,000", "1000.50", "£1,000.50", "$1000"
  const currencyPattern = /^[£$]?\d{1,3}(,?\d{3})*(\.\d{1,2})?$/;

  if (!currencyPattern.test(trimmed)) {
    return undefined;
  }

  const firstMinus = trimmed.indexOf("-");

  // Reject if minus sign is not at the start or appears multiple times
  if (firstMinus > 0 || trimmed.indexOf("-", firstMinus + 1) !== -1) {
    return undefined;
  }

  const sign = firstMinus === 0 ? "-" : "";
  const normalised = sign + trimmed.replace(/[^0-9.]/g, "");

  // Reject if multiple decimal points
  if ((normalised.match(/\./g) ?? []).length > 1) {
    return undefined;
  }

  const parsed = Number(normalised);

  // Reject if not finite or negative
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

export interface FormValidationErrors {
  title?: string;
  purchasePrice?: string;
  estimatedGdv?: string;
  expectedMonthlyRent?: string;
  refurbBudget?: string;
  region?: string;
  propertyCondition?: string;
  propertySize?: string;
}

/**
 * Validate and parse raw form data into typed payload.
 * Returns validation errors if any field is invalid.
 */
export function validateFormData(formData: {
  title: string;
  purchasePrice: string;
  estimatedGdv: string;
  expectedMonthlyRent: string;
  refurbBudget: string;
  region: UKRegion;
  propertyCondition: ConditionLevel;
  holdingCosts: string;
  propertySize?: string;
}): { valid: false; errors: FormValidationErrors } | { valid: true; data: ParsedDealFormData } {
  const errors: FormValidationErrors = {};

  // Validate title
  if (!formData.title?.trim()) {
    errors.title = "Deal title is required";
  }

  // Validate currency fields
  const purchasePrice = parseMoney(formData.purchasePrice);
  if (!purchasePrice) {
    errors.purchasePrice = "Valid purchase price required";
  }

  const estimatedGdv = parseMoney(formData.estimatedGdv);
  if (!estimatedGdv) {
    errors.estimatedGdv = "Valid estimated GDV required";
  }

  const expectedMonthlyRent = parseMoney(formData.expectedMonthlyRent);
  if (!expectedMonthlyRent) {
    errors.expectedMonthlyRent = "Valid expected monthly rent required";
  }

  const refurbBudget = parseMoney(formData.refurbBudget);
  if (!refurbBudget) {
    errors.refurbBudget = "Valid refurb budget required";
  }

  const holdingCosts = formData.holdingCosts ? parseMoney(formData.holdingCosts) : 0;

  // Validate enums
  if (!formData.region) {
    errors.region = "Region is required";
  }

  if (!formData.propertyCondition) {
    errors.propertyCondition = "Property condition is required";
  }

  // Optional property size
  let propertySize: number | undefined;
  if (formData.propertySize) {
    const parsed = parseMoney(formData.propertySize);
    if (!parsed) {
      errors.propertySize = "Valid property size required";
    } else {
      propertySize = parsed;
    }
  }

  // If any errors, return early
  if (Object.keys(errors).length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  // All required fields validated; return typed data
  return {
    valid: true,
    data: {
      title: formData.title.trim(),
      purchasePrice: purchasePrice!,
      estimatedGdv: estimatedGdv!,
      refurbBudget: refurbBudget!,
      rentalIncome: expectedMonthlyRent!,
      holdingCosts: holdingCosts ?? 0,
      region: formData.region,
      propertyCondition: formData.propertyCondition,
      propertySize,
    },
  };
}

/**
 * Check if all required fields are present (for form completeness indicator).
 */
export function getRequiredFieldsStatus(formData: {
  title: string;
  purchasePrice: string;
  estimatedGdv: string;
  expectedMonthlyRent: string;
  refurbBudget: string;
  region: UKRegion;
  propertyCondition: ConditionLevel;
}): {
  completed: number;
  total: number;
  missingFields: string[];
} {
  const fields = [
    { name: "Deal title", value: formData.title?.trim() },
    { name: "Purchase price", value: parseMoney(formData.purchasePrice) },
    { name: "Estimated GDV", value: parseMoney(formData.estimatedGdv) },
    { name: "Expected monthly rent", value: parseMoney(formData.expectedMonthlyRent) },
    { name: "Refurb budget", value: parseMoney(formData.refurbBudget) },
    { name: "Region", value: formData.region },
    { name: "Property condition", value: formData.propertyCondition },
  ];

  const completed = fields.filter((f) => f.value).length;
  const missingFields = fields.filter((f) => !f.value).map((f) => f.name);

  return {
    completed,
    total: fields.length,
    missingFields,
  };
}
