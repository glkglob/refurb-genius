/**
 * Operational validation fixtures for AI provider quality monitoring.
 *
 * These fixtures test real-world scenarios to detect prompt drift
 * and AI quality regressions over time.
 */

import type { RoomAnalysis, RoomType, ConditionLevel } from "@/lib/analysis";
import type { RedesignConcept, RedesignStyle } from "@/lib/redesign";

// Vision provider fixtures - various room types and conditions
export const VISION_TEST_FIXTURES = {
  kitchen_poor: {
    scenario: "kitchen_poor",
    expectedRoomType: "Kitchen" as RoomType,
    expectedCondition: "Poor" as ConditionLevel,
    expectedRefurbLevel: "Heavy" as const,
    description: "Dated kitchen with worn cabinetry, damaged worktops, old appliances",
  },
  bathroom_dated: {
    scenario: "bathroom_dated",
    expectedRoomType: "Bathroom" as RoomType,
    expectedCondition: "Dated" as ConditionLevel,
    expectedRefurbLevel: "Medium" as const,
    description: "Dated bathroom with cracked tiling, mould, outdated suite",
  },
  living_room_average: {
    scenario: "living_room_average",
    expectedRoomType: "Living Room" as RoomType,
    expectedCondition: "Average" as ConditionLevel,
    expectedRefurbLevel: "Light" as const,
    description: "Average living room with tired paintwork, worn carpet",
  },
  exterior_dated: {
    scenario: "exterior_dated",
    expectedRoomType: "Exterior" as RoomType,
    expectedCondition: "Dated" as ConditionLevel,
    expectedRefurbLevel: "Medium" as const,
    description: "Exterior with degraded pointing, weathered door, overgrown garden",
  },
  empty_room: {
    scenario: "empty_room",
    expectedRoomType: "Other" as RoomType, // Fallback for ambiguous
    expectedCondition: "Average" as ConditionLevel,
    expectedRefurbLevel: "Light" as const,
    description: "Empty room - minimal visible detail",
  },
};

// Redesign provider fixtures - various styles and budgets
export const REDESIGN_TEST_FIXTURES: Array<{
  scenario: string;
  style: RedesignStyle;
  budget: "budget" | "standard" | "premium";
  description: string;
}> = [
  {
    scenario: "modern_minimal",
    style: "Modern",
    budget: "standard",
    description: "Clean lines, neutral palette, minimal furnishings",
  },
  {
    scenario: "luxury_contemporary",
    style: "Luxury",
    budget: "premium",
    description: "Rich materials, deep tones, statement details",
  },
  {
    scenario: "scandinavian_budget",
    style: "Scandinavian",
    budget: "budget",
    description: "Light, airy, natural materials on a budget",
  },
  {
    scenario: "rental_standard",
    style: "Rental Standard",
    budget: "budget",
    description: "Durable, neutral, mass-appeal finishes",
  },
  {
    scenario: "contemporary_premium",
    style: "Contemporary",
    budget: "premium",
    description: "Cutting-edge design, premium finishes",
  },
];

// Quality thresholds for operational monitoring
export const QUALITY_THRESHOLDS = {
  vision: {
    min_confidence_score: 0.65, // Low confidence indicates possible hallucination
    acceptable_fallback_rate: 0.15, // Max 15% fallback usage
    max_timeout_rate: 0.1, // Max 10% timeouts
  },
  redesign: {
    min_palette_colors: 4, // Each palette should have 4 colors
    acceptable_fallback_rate: 0.2, // Max 20% fallback usage
    max_timeout_rate: 0.15, // Max 15% timeouts
  },
};

// Real-world validation checks
export function validateVisionOutput(
  analysis: RoomAnalysis,
  fixture: (typeof VISION_TEST_FIXTURES)[keyof typeof VISION_TEST_FIXTURES],
): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Room type should match fixture or be fallback
  if (analysis.room_type !== fixture.expectedRoomType && analysis.room_type !== "Other") {
    issues.push(
      `room_type mismatch: expected ${fixture.expectedRoomType} or Other, got ${analysis.room_type}`,
    );
  }

  // Confidence score should be reasonable
  if (analysis.confidence_score < QUALITY_THRESHOLDS.vision.min_confidence_score) {
    issues.push(
      `low confidence score: ${analysis.confidence_score} (min: ${QUALITY_THRESHOLDS.vision.min_confidence_score})`,
    );
  }

  // Always should have at least one visible issue and work item (or fallback)
  if (analysis.visible_issues.length === 0) {
    issues.push("no visible_issues provided");
  }
  if (analysis.recommended_works.length === 0) {
    issues.push("no recommended_works provided");
  }

  // Summary should be non-empty
  if (analysis.ai_summary.length === 0) {
    issues.push("empty ai_summary");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateRedesignOutput(
  concept: RedesignConcept,
  budget: string,
): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Palette should have 4 colors
  if (concept.palette.length < QUALITY_THRESHOLDS.redesign.min_palette_colors) {
    issues.push(
      `palette too small: ${concept.palette.length} colors (min: ${QUALITY_THRESHOLDS.redesign.min_palette_colors})`,
    );
  }

  // All palette colors should be valid hex
  concept.palette.forEach((color) => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(color.hex)) {
      issues.push(`invalid hex color: ${color.hex}`);
    }
  });

  // Tagline should be present and reasonable length
  if (concept.tagline.length === 0) {
    issues.push("empty tagline");
  }
  if (concept.tagline.length > 100) {
    issues.push(`tagline too long: ${concept.tagline.length} chars`);
  }

  // Flooring, lighting, furniture should be present
  if (concept.flooring.length === 0) {
    issues.push("empty flooring description");
  }
  if (concept.lighting.length === 0) {
    issues.push("empty lighting description");
  }
  if (concept.furniture.length === 0) {
    issues.push("empty furniture description");
  }

  // After gradient should be valid CSS
  if (concept.afterGradient && !concept.afterGradient.includes("gradient")) {
    issues.push(`invalid afterGradient: ${concept.afterGradient}`);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
