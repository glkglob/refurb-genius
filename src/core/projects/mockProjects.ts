// Mock projects for demos, empty-state previews, and tests. Not persisted.
// Keep shapes aligned with the canonical `Project` type so consumers can
// swap a mock in for a real row without branching.
import type { Project } from "@/lib/projects";

export const MOCK_PROJECTS: Project[] = [
  {
    id: "mock-victorian-terrace",
    user_id: "mock-user",
    name: "Victorian Terrace Refurb",
    address: "12 Elm Street, London",
    postcode: "E1 6AN",
    region: "London",
    property_type: "Terraced",
    bedrooms: 3,
    bathrooms: 1,
    size_sqm: 95,
    purchase_price: 285_000,
    estimated_gdv: 410_000,
    notes: "Full cosmetic refurb, retain layout.",
    created_at: new Date("2026-04-01").toISOString(),
    status: "Estimated",
  },
  {
    id: "mock-semi-detached",
    user_id: "mock-user",
    name: "Semi-detached Family Home",
    address: "44 Oak Avenue, Manchester",
    postcode: "M20 2AA",
    region: "North West England",
    property_type: "Semi-detached",
    bedrooms: 4,
    bathrooms: 2,
    size_sqm: 120,
    purchase_price: 240_000,
    estimated_gdv: 360_000,
    notes: "Kitchen extension and loft conversion.",
    created_at: new Date("2026-03-15").toISOString(),
    status: "Analysing",
  },
];

export function getMockProjectById(id: string): Project | undefined {
  return MOCK_PROJECTS.find((p) => p.id === id);
}
