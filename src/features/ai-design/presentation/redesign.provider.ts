/**
 * AI-design slice — Client-side redesign provider (presentation wiring).
 * Moved from `src/core/ai/redesignConcepts.ts` (now a shim).
 */
import { REDESIGN_CONCEPTS, REDESIGN_STYLES } from "@/lib/redesign";
import type { RedesignConcept, RedesignStyle } from "../domain";
import { analysisStore, hasMockAnalysis, isMockOnlyAnalysisSet } from "@/features/ai-upload";
import { generateRedesignConceptsServerFn } from "./serverFns";

/** Redesign may not consume mock or photo_id-less analysis authority. */
function isRedesignAuthorityUsable(
  analyses: Array<{ source?: string; photo_id?: string | null }>,
): boolean {
  if (!analyses.length) return false;
  if (hasMockAnalysis(analyses as never) || isMockOnlyAnalysisSet(analyses as never)) return false;
  if (analyses.some((a) => !a.photo_id || a.source === "mock")) return false;
  const ids = analyses.map((a) => a.photo_id as string);
  return new Set(ids).size === ids.length;
}

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

    const analyses = analysisStore.get(input.projectId) ?? [];
    // Do not derive redesign from mock, missing photo_id, or incomplete authority.
    if (!isRedesignAuthorityUsable(analyses)) {
      throw new Error(
        "Previous analysis was not based on the current project photos. Run analysis again to use your uploaded photos.",
      );
    }

    const concepts = await generateRedesignConceptsServerFn({
      data: {
        projectId: input.projectId,
        styles: input.styles,
        analyses,
      },
    });

    cache.set(input.projectId, concepts);
    return concepts;
  },
};

/** Drop cached redesign concepts so the next generate uses fresh analyses. */
export function clearRedesignConceptsCache(projectId: string): void {
  cache.delete(projectId);
}

export function listRedesignConcepts(input?: RedesignInput): RedesignConcept[] {
  return redesignProvider.list(input);
}

export function generateRedesignConcepts(input: RedesignInput): Promise<RedesignConcept[]> {
  return redesignProvider.generate(input);
}

export { REDESIGN_CONCEPTS, REDESIGN_STYLES };
