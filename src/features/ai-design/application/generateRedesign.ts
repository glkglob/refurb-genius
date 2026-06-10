/**
 * AI-design slice — GenerateRedesign use case.
 */
import type { GenerateRedesignInput, RedesignConcept } from "../domain";
import type { AiRedesignPort, RedesignCachePort } from "./ports";

export type GenerateRedesignCommand = GenerateRedesignInput;

export type GenerateRedesignDeps = {
  redesign: AiRedesignPort;
  cache?: RedesignCachePort;
};

export function makeGenerateRedesign({ redesign, cache }: GenerateRedesignDeps) {
  return async function generateRedesign(
    command: GenerateRedesignCommand,
  ): Promise<RedesignConcept[]> {
    const cached = cache?.get(command.projectId);
    if (cached) return cached;

    const concepts = await redesign.generateConcepts(command);
    cache?.set(command.projectId, concepts);
    return concepts;
  };
}
