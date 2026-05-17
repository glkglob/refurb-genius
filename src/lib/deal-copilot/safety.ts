/**
 * Production Safety Checks for Deal Copilot Lite
 *
 * Validates that all rendered financial values are safe before display.
 * Prevents NaN, Infinity, undefined, and other edge cases from reaching the UI.
 */

import { dealCopilotDiagnostics } from "@/lib/deal-copilot/diagnostics";

/**
 * Validate that a value is a finite number safe for display
 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Validate ROI result before rendering
 */
export function validateRoiForDisplay(roi: Record<string, unknown> | null | undefined): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!roi) {
    errors.push("ROI result is null/undefined");
    return { valid: false, errors };
  }

  // Check all required numeric fields
  const numericFields = [
    "roi",
    "gross_yield",
    "estimated_profit",
    "total_project_cost",
    "investment_score",
    "rental_uplift",
  ];

  numericFields.forEach((field) => {
    const value = roi[field];
    if (!isFiniteNumber(value)) {
      errors.push(`${field}: ${value} (type: ${typeof value})`);
      dealCopilotDiagnostics.renderInvalidValue(field, value);
    }
  });

  // Check recommendation enum
  const validRecommendations = ["Strong", "Consider", "Watch", "Reject"];
  if (!validRecommendations.includes(String(roi.recommendation))) {
    errors.push(`invalid recommendation: ${roi.recommendation}`);
    dealCopilotDiagnostics.renderInvalidValue("recommendation", roi.recommendation);
  }

  // Check risk level enum
  const validRiskLevels = ["Low", "Moderate", "High"];
  if (!validRiskLevels.includes(String(roi.risk_level))) {
    errors.push(`invalid risk_level: ${roi.risk_level}`);
    dealCopilotDiagnostics.renderInvalidValue("risk_level", roi.risk_level);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate pricing result before rendering
 */
export function validatePricingForDisplay(pricing: Record<string, unknown> | null | undefined): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!pricing) {
    errors.push("Pricing result is null/undefined");
    return { valid: false, errors };
  }

  // Check all required numeric fields
  const numericFields = [
    "labour_total",
    "materials_total",
    "subtotal",
    "contingency",
    "vat",
    "low_total",
    "mid_total",
    "high_total",
    "timeline_weeks",
  ];

  numericFields.forEach((field) => {
    const value = pricing[field];
    if (!isFiniteNumber(value)) {
      errors.push(`${field}: ${value} (type: ${typeof value})`);
      dealCopilotDiagnostics.renderInvalidValue(field, value);
    }
  });

  // Check estimate items array
  if (!Array.isArray(pricing.estimate_items)) {
    errors.push(`estimate_items: not an array`);
    dealCopilotDiagnostics.renderInvalidValue("estimate_items", pricing.estimate_items);
  } else {
    (pricing.estimate_items as unknown[]).forEach((item: unknown, index: number) => {
      const itemRecord = item as Record<string, unknown>;
      const itemErrors: string[] = [];
      if (!isFiniteNumber(itemRecord.labour)) itemErrors.push(`labour`);
      if (!isFiniteNumber(itemRecord.materials)) itemErrors.push(`materials`);
      if (!isFiniteNumber(itemRecord.total)) itemErrors.push(`total`);
      if (!isFiniteNumber(itemRecord.weeks)) itemErrors.push(`weeks`);
      if (itemErrors.length > 0) {
        errors.push(`estimate_items[${index}]: invalid ${itemErrors.join(", ")}`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Safe rendering utility: always returns a valid display value
 */
export function safeDisplayValue(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "string") {
    return value.trim() || fallback;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      dealCopilotDiagnostics.renderInvalidValue("numeric", value);
      return fallback;
    }
    return String(value);
  }

  dealCopilotDiagnostics.renderInvalidValue("generic", value);
  return fallback;
}

/**
 * Validate entire analysis result before rendering
 */
export function validateAnalysisForDisplay(analysis: Record<string, unknown> | null | undefined): {
  valid: boolean;
  readySafe: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!analysis) {
    errors.push("Analysis result is null/undefined");
    return { valid: false, readySafe: false, errors };
  }

  // Check ready flag
  const readySafe = analysis.ready === true;

  // If not ready, check for proper incomplete state
  if (!readySafe) {
    const scoreRecord = analysis.score as Record<string, unknown> | undefined;
    if (scoreRecord?.recommendation !== "Incomplete") {
      errors.push(
        `Incomplete analysis but recommendation is not "Incomplete": ${scoreRecord?.recommendation}`,
      );
    }
    return {
      valid: errors.length === 0,
      readySafe,
      errors,
    };
  }

  // If ready, validate all required results
  if (!analysis.score) {
    errors.push("Ready but score is missing");
  } else {
    const scoreRecord = analysis.score as Record<string, unknown>;
    if (!["Strong", "Consider", "Watch", "Reject"].includes(String(scoreRecord.recommendation))) {
      errors.push(`Invalid recommendation: ${scoreRecord.recommendation}`);
    }
  }

  if (!analysis.roi) {
    errors.push("Ready but ROI result is missing");
  } else {
    const roiValidation = validateRoiForDisplay(analysis.roi as Record<string, unknown>);
    if (!roiValidation.valid) {
      errors.push(...roiValidation.errors);
    }
  }

  // Pricing is optional
  if (analysis.pricing && typeof analysis.pricing === "object") {
    const pricingValidation = validatePricingForDisplay(
      analysis.pricing as Record<string, unknown>,
    );
    if (!pricingValidation.valid) {
      errors.push(...pricingValidation.errors);
    }
  }

  return {
    valid: errors.length === 0,
    readySafe,
    errors,
  };
}
