// Backward compatibility shim. AI summaries have been extracted to @repo/services.
// Use @repo/services directly for new code.

export {
  aiSummariesProvider,
  mockAiSummariesProvider,
  reportHeadline,
  executiveSummary,
  roomSummary,
  recommendedWorks,
} from "@repo/services";
export type { AiSummariesProvider, ProjectSummaryInput } from "@repo/services";
