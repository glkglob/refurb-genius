/**
 * AI-design slice — Deterministic mock scope (dev / no-API-key fallback).
 */
import type { ScopeAnalysisInput, ScopeAnalysisResult, ScopeRoom } from "./types";

export function buildMockScopeResult(input: ScopeAnalysisInput): ScopeAnalysisResult {
  const rooms: ScopeRoom[] = [];

  if (input.roomTags.includes("Kitchen") || input.roomTags.length === 0) {
    rooms.push({
      room: "Kitchen",
      area_sqm: 12,
      condition_summary: "Dated units and worktops, functional but cosmetically poor.",
      issues: [
        {
          category: "Cosmetic",
          description: "Kitchen units are dated with visible wear and chipping",
          severity: "high",
          recommended_action: "Replace all base and wall units",
        },
        {
          category: "Plumbing",
          description: "Tap showing signs of corrosion, slow drain visible",
          severity: "medium",
          recommended_action: "Replace mixer tap and check waste pipe",
        },
      ],
      recommended_items: [
        {
          name: "Kitchen units supply & fit",
          category: "both",
          quantity: 1,
          unit: "kitchen",
          base_unit_cost: 8500,
          notes: "Mid-range units with soft close",
        },
        {
          name: "Worktops (laminate)",
          category: "materials",
          quantity: 4,
          unit: "lm",
          base_unit_cost: 120,
        },
        {
          name: "Tiling splashback",
          category: "both",
          quantity: 6,
          unit: "sqm",
          base_unit_cost: 65,
        },
        {
          name: "Plumbing first fix",
          category: "labour",
          quantity: 1,
          unit: "item",
          base_unit_cost: 850,
        },
      ],
    });
  }

  if (input.roomTags.includes("Bathroom") || input.roomTags.length === 0) {
    rooms.push({
      room: "Bathroom",
      area_sqm: 5,
      condition_summary: "Suite is functional but severely dated. Tiling cracked in places.",
      issues: [
        {
          category: "Cosmetic",
          description: "Bathroom suite is 20+ years old with staining and limescale",
          severity: "high",
          recommended_action: "Full bathroom replacement",
        },
        {
          category: "Damp",
          description: "Mould visible around bath sealant and ceiling corner",
          severity: "medium",
          recommended_action: "Re-seal bath, treat mould, improve ventilation",
        },
      ],
      recommended_items: [
        {
          name: "Bathroom suite (bath, basin, WC)",
          category: "materials",
          quantity: 1,
          unit: "suite",
          base_unit_cost: 1200,
        },
        {
          name: "Bathroom fit-out labour",
          category: "labour",
          quantity: 1,
          unit: "item",
          base_unit_cost: 2800,
        },
        {
          name: "Wall & floor tiling",
          category: "both",
          quantity: 14,
          unit: "sqm",
          base_unit_cost: 75,
        },
        {
          name: "Extractor fan install",
          category: "both",
          quantity: 1,
          unit: "item",
          base_unit_cost: 280,
        },
      ],
    });
  }

  if (input.roomTags.includes("Living Room") || input.roomTags.length === 0) {
    rooms.push({
      room: "Living Room",
      area_sqm: 18,
      condition_summary: "Cosmetically dated. Walls need preparation and re-decoration.",
      issues: [
        {
          category: "Cosmetic",
          description: "Walls show cracks in plaster and peeling wallpaper",
          severity: "medium",
          recommended_action: "Strip, replaster patches, and redecorate",
        },
      ],
      recommended_items: [
        {
          name: "Decoration (walls & ceiling)",
          category: "both",
          quantity: 1,
          unit: "room",
          base_unit_cost: 850,
        },
        {
          name: "Flooring (LVT)",
          category: "both",
          quantity: 18,
          unit: "sqm",
          base_unit_cost: 45,
        },
      ],
    });
  }

  // Add bedrooms if tagged
  if (input.roomTags.includes("Bedrooms") || input.roomTags.length === 0) {
    for (let i = 1; i <= Math.min(input.bedrooms, 4); i++) {
      rooms.push({
        room: `Bedroom ${i}`,
        condition_summary: "Cosmetically tired but structurally sound.",
        issues: [
          {
            category: "Cosmetic",
            description: "Walls and ceiling need redecoration",
            severity: "low",
            recommended_action: "Prepare and repaint",
          },
        ],
        recommended_items: [
          {
            name: "Decoration (walls & ceiling)",
            category: "both",
            quantity: 1,
            unit: "room",
            base_unit_cost: 650,
          },
          {
            name: "Flooring (LVT)",
            category: "both",
            quantity: 12,
            unit: "sqm",
            base_unit_cost: 45,
          },
        ],
      });
    }
  }

  // Always include Whole Property items
  rooms.push({
    room: "Whole Property",
    condition_summary: "Electrics and heating need assessment. General updates required.",
    issues: [
      {
        category: "Electrical",
        description: "Consumer unit is old BS-type fuse board, not compliant",
        severity: "critical",
        recommended_action: "Full rewire and consumer unit upgrade",
      },
      {
        category: "Plumbing",
        description: "Boiler appears to be 15+ years old",
        severity: "high",
        recommended_action: "Replace with modern combi boiler",
      },
    ],
    recommended_items: [
      {
        name: "Full rewire",
        category: "labour",
        quantity: 1,
        unit: "item",
        base_unit_cost: 4200,
      },
      {
        name: "Consumer unit upgrade",
        category: "both",
        quantity: 1,
        unit: "item",
        base_unit_cost: 650,
      },
      {
        name: "Combi boiler replacement",
        category: "both",
        quantity: 1,
        unit: "item",
        base_unit_cost: 3200,
      },
    ],
  });

  return {
    overall_score: 4.5,
    summary:
      "This property requires a comprehensive modernisation. Key concerns include dated kitchen and bathroom, non-compliant electrics, and an ageing boiler. Cosmetic updates needed throughout.",
    rooms,
  };
}
