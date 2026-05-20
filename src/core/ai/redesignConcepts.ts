// AI redesign concepts surface.
//
// Today this returns curated mock concepts with CSS-gradient placeholders
// in place of generated imagery. The provider interface below is the only
// thing UI code imports. The browser talks only to an internal server
// function; OpenAI stays behind that server boundary.
//
// AI is responsible for: style direction, palette, materials, lighting,
// furniture suggestions, and image placeholders. AI is NOT responsible
// for any pricing, ROI, or financial numbers.
import { REDESIGN_CONCEPTS, REDESIGN_STYLES } from "@/lib/redesign";
import type { RedesignConcept, RedesignStyle } from "@/lib/redesign";
import { analysisStore } from "@/lib/analysis";
import { generateRedesignConceptsServerFn } from "./serverFns";

export type RedesignInput = {
  projectId: string;
  /** Optional style filter — defaults to all styles. */
  styles?: RedesignStyle[];
  /** Optional room context for future room-aware concept generation. */
  roomType?: string;
};

export type RedesignProvider = {
  list(input?: RedesignInput): RedesignConcept[];
  /**
   * Generate fresh redesign concepts. Mock returns curated entries; future
   * provider will call an image-gen model and persist URLs.
   */
  generate(input: RedesignInput): Promise<RedesignConcept[]>;
};

export const mockRedesignProvider: RedesignProvider = {
  list({ styles } = {} as RedesignInput) {
    if (!styles?.length) return REDESIGN_CONCEPTS;
    const set = new Set(styles);
    return REDESIGN_CONCEPTS.filter((c) => set.has(c.style));
  },
  async generate(input) {
    // Mock: synchronous fetch from curated list, no network.
    // TODO: implement `geminiImageRedesignProvider` that posts to the
    // Lovable AI Gateway image model and returns concept entries with real
    // `afterGradient` replaced by generated image URLs.
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
export type { RedesignConcept, RedesignStyle };
