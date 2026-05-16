// AI redesign concepts surface.
//
// Today this returns curated mock concepts with CSS-gradient placeholders
// in place of generated imagery. The provider interface below is the only
// thing UI code imports, so swapping in real image generation (e.g. Nano
// Banana / Gemini image preview) later is a one-file change.
//
// AI is responsible for: style direction, palette, materials, lighting,
// furniture suggestions, and image placeholders. AI is NOT responsible
// for any pricing, ROI, or financial numbers.
import { REDESIGN_CONCEPTS, REDESIGN_STYLES } from "@/lib/redesign";
import type { RedesignConcept, RedesignStyle } from "@/lib/redesign";

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

import { openAiRedesignProvider } from "./openAiRedesignProvider";

export const redesignProvider: RedesignProvider = import.meta.env.VITE_OPENAI_API_KEY
  ? openAiRedesignProvider
  : mockRedesignProvider;

export function listRedesignConcepts(input?: RedesignInput): RedesignConcept[] {
  return redesignProvider.list(input);
}

export function generateRedesignConcepts(input: RedesignInput): Promise<RedesignConcept[]> {
  return redesignProvider.generate(input);
}

export { REDESIGN_CONCEPTS, REDESIGN_STYLES };
export type { RedesignConcept, RedesignStyle };
