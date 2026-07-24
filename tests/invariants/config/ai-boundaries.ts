/**
 * AI provider boundary registration (current enforcement + future policy).
 * Registration only — no new CI rules.
 */
import type { RegistryStatus } from "./types";

export type AiBoundary = {
  id: string;
  description: string;
  approvedLocations: string[];
  prohibitedLocations: string[];
  providers: string[];
  enforcementStatus: RegistryStatus;
  source: string;
  notes?: string;
};

export const AI_BOUNDARIES: AiBoundary[] = [
  {
    id: "provider-sdk-platform-only",
    description: "Direct AI provider SDK imports are restricted to platform adapters",
    approvedLocations: ["src/platform/openai/server.ts", "src/platform/huggingface/server.ts"],
    prohibitedLocations: [
      "src/routes/**",
      "src/components/**",
      "src/features/**/domain/**",
      "src/features/**/presentation/**",
      "packages/core/**",
      "packages/services/**",
      "packages/types/**",
    ],
    providers: ["openai", "@huggingface/inference"],
    enforcementStatus: "enforced",
    source: "tests/invariants/platform-boundary.invariant.test.ts",
    notes:
      "Anthropic/Gemini not present. Feature *.adapter.server.ts files must use getOpenAIClient / HF platform helpers — not import SDKs directly (feature-slice invariant).",
  },
  {
    id: "future-providers-same-model",
    description: "Any future provider SDK must land under src/platform/<vendor> first",
    approvedLocations: ["src/platform/<vendor>/"],
    prohibitedLocations: [
      "presentation",
      "domain packages",
      "product modules constructing clients",
    ],
    providers: ["* (future)"],
    enforcementStatus: "documented",
    source: "docs/architecture/overview.md; ADR 0001",
    notes: "Not a new enforcement rule — documents the extension model.",
  },
  {
    id: "ai-orchestration-helpers",
    description: "Shared retry/orchestrator/cache under src/core/ai/platform",
    approvedLocations: ["src/core/ai/platform", "src/core/ai"],
    prohibitedLocations: [],
    providers: [],
    enforcementStatus: "documented",
    source: "src/core/ai/platform/*",
    notes: "Helpers, not SDK homes.",
  },
];
