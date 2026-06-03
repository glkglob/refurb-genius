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
import { supabase } from "@/services/supabase";
import { logger } from "@/lib/logger";

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
 *
 * // PRIMARY PATH (for heavy property/deal analysis per docs/architecture/analysis-paths.md)
 * Use this as the default for photo + scope + estimate + redesign heavy jobs,
 * especially in Deal Copilot flows (when address/postcode provided) and full
 * project intel. TS serverFns are light/fast fallback or preview only.
 *
 * Strengthened: includes token forwarding for verified user, error handling,
 * and abort support. Falls back gracefully on failure.
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
    async (
      input: PropertyAnalysisInput,
      userId?: string,
      options?: { fallback?: () => Promise<unknown> },
    ) => {
      reset();

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        const { job_id } = await startAnalysis(input, userId, token);

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
        // Strengthen fallback between paths (PRIMARY Railway <-> TS light)
        if (options?.fallback) {
          try {
            return await options.fallback();
          } catch (fbErr) {
            logger.warn("[railway] fallback also failed", { fbErr });
          }
        }
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
