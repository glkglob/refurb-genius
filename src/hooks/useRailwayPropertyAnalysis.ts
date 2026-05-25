import { useCallback, useRef, useState } from "react";
import {
  startAnalysis,
  getAnalysisStatus,
  getAnalysisResult,
  pollAnalysisResult,
  type PropertyAnalysisInput,
  type JobStatusResponse,
  type JobResultResponse,
} from "@/lib/api/railwayAnalysis";

export type AnalysisJobState = {
  jobId: string | null;
  status: "idle" | "pending" | "processing" | "completed" | "failed";
  result: Record<string, unknown> | null;
  error: string | null;
  isPolling: boolean;
};

const initialState: AnalysisJobState = {
  jobId: null,
  status: "idle",
  result: null,
  error: null,
  isPolling: false,
};

/**
 * Hook for the Railway async property analysis flow.
 * Starts the job on Railway, polls status, and surfaces result or error.
 * Keeps the heavy AI work off Vercel server functions.
 */
export function useRailwayPropertyAnalysis() {
  const [state, setState] = useState<AnalysisJobState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(initialState);
  }, []);

  const start = useCallback(
    async (input: PropertyAnalysisInput, userId?: string) => {
      reset();

      try {
        const { job_id } = await startAnalysis(input, userId);

        setState((s) => ({
          ...s,
          jobId: job_id,
          status: "pending",
          isPolling: true,
        }));

        abortRef.current = new AbortController();

        const final = await pollAnalysisResult(job_id, {
          intervalMs: 1800,
          maxAttempts: 80,
          signal: abortRef.current.signal,
          onUpdate: (status: JobStatusResponse) => {
            setState((s) => ({
              ...s,
              status: status.status as AnalysisJobState["status"],
            }));
          },
        });

        setState((s) => ({
          ...s,
          status: final.status as AnalysisJobState["status"],
          result: final.result ?? null,
          error: final.error_message ?? null,
          isPolling: false,
        }));

        return final;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Analysis failed";
        setState((s) => ({
          ...s,
          status: "failed",
          error: message,
          isPolling: false,
        }));
        throw err;
      }
    },
    [reset],
  );

  return {
    ...state,
    start,
    reset,
  };
}
