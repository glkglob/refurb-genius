/**
 * AI-design slice — Client-side redesign provider (presentation wiring).
 * Moved from `src/core/ai/redesignConcepts.ts` (now a shim).
 */
import { REDESIGN_CONCEPTS, REDESIGN_STYLES } from "@/lib/redesign";
import type { RedesignConcept, RedesignStyle } from "../domain";
import { analysisStore } from "@/features/ai-upload/infrastructure";
import { generateRedesignConceptsServerFn } from "./serverFns";

export type RedesignInput = {
  projectId: string;
  styles?: RedesignStyle[];
  roomType?: string;
};

export type RedesignProvider = {
  list(input?: RedesignInput): RedesignConcept[];
  generate(input: RedesignInput): Promise<RedesignConcept[]>;
};

export const mockRedesignProvider: RedesignProvider = {
  list({ styles } = {} as RedesignInput) {
    if (!styles?.length) return REDESIGN_CONCEPTS;
    const set = new Set(styles);
    return REDESIGN_CONCEPTS.filter((c) => set.has(c.style));
  },
  async generate(input) {
    return mockRedesignProvider.list(input);
  },
};

const cache = new Map<string, RedesignConcept[]>();

export const redesignProvider: RedesignProvider = {
  list(input = {} as RedesignInput) {
    const cached = cache.get(input.projectId ?? "");
    if (cached) {
      const styles = input.styles?.length ? new Set(input.styles) : null;
      return styles ? cached.filter((concept) => styles.has(concept.style)) : cached;
    }
    return mockRedesignProvider.list(input);
  },
  async generate(input) {
    const cached = cache.get(input.projectId);
    if (cached) return cached;

    const concepts = await generateRedesignConceptsServerFn({
      data: {
        projectId: input.projectId,
        styles: input.styles,
        analyses: analysisStore.get(input.projectId) ?? [],
      },
    });

    cache.set(input.projectId, concepts);
    return concepts;
  },
};

export function listRedesignConcepts(input?: RedesignInput): RedesignConcept[] {
  return redesignProvider.list(input);
}

export function generateRedesignConcepts(input: RedesignInput): Promise<RedesignConcept[]> {
  return redesignProvider.generate(input);
}

export { REDESIGN_CONCEPTS, REDESIGN_STYLES };
