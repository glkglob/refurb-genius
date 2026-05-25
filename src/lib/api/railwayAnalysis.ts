/**
 * Railway FastAPI Analysis Client
 *
 * Used by the frontend (Vercel) to talk to the backend (Railway) for
 * long-running property / deal intelligence jobs.
 *
 * All calls go through VITE_API_BASE_URL.
 * Backend owns OPENAI_API_KEY + Supabase service role.
 * Frontend never sees service keys.
 */

const getApiBase = (): string => {
  // Vite exposes import.meta.env.VITE_* at build time
  const env = import.meta.env as Record<string, string | undefined>;
  const base =
    env.VITE_API_BASE_URL ||
    env.NEXT_PUBLIC_API_BASE_URL || // compat fallback
    "";

  // In dev without the var set, fall back to localhost backend for convenience
  if (!base && import.meta.env.DEV) {
    return "http://localhost:8000";
  }
  return base.replace(/\/$/, ""); // strip trailing slash
};

export interface PropertyAnalysisInput {
  property_address?: string;
  postcode?: string;
  region?: string;
  property_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  purchase_price?: number;
  estimated_gdv?: number;
  condition?: string;
  notes?: string;
  [key: string]: unknown; // allow flexible extra fields from forms
}

export interface JobCreateResponse {
  job_id: string;
  status: "pending";
}

export interface JobStatusResponse {
  job_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
}

export interface JobResultResponse {
  job_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  result?: Record<string, unknown>;
  error_message?: string;
}

/**
 * Start a new async property analysis job on Railway.
 * Returns immediately with a job_id the frontend can poll.
 */
export async function startAnalysis(
  input: PropertyAnalysisInput,
  userId?: string,
): Promise<JobCreateResponse> {
  const base = getApiBase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (userId) {
    headers["X-User-Id"] = userId;
  }

  const res = await fetch(`${base}/analyze-property`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to start analysis: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Poll the current status of a job.
 */
export async function getAnalysisStatus(jobId: string): Promise<JobStatusResponse> {
  const base = getApiBase();
  const res = await fetch(`${base}/analysis-status/${jobId}`);

  if (!res.ok) {
    throw new Error(`Failed to get job status: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch the final result (only meaningful once status === "completed").
 */
export async function getAnalysisResult(jobId: string): Promise<JobResultResponse> {
  const base = getApiBase();
  const res = await fetch(`${base}/analysis-result/${jobId}`);

  if (!res.ok) {
    throw new Error(`Failed to get job result: ${res.status}`);
  }

  return res.json();
}

/**
 * Convenience polling helper.
 * Calls onUpdate every interval until terminal state or max attempts.
 * Returns the final result when done.
 */
export async function pollAnalysisResult(
  jobId: string,
  options: {
    intervalMs?: number;
    maxAttempts?: number;
    onUpdate?: (status: JobStatusResponse) => void;
    signal?: AbortSignal;
  } = {},
): Promise<JobResultResponse> {
  const { intervalMs = 2000, maxAttempts = 60, onUpdate, signal } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new Error("Polling aborted");
    }

    const status = await getAnalysisStatus(jobId);
    onUpdate?.(status);

    if (status.status === "completed" || status.status === "failed") {
      return getAnalysisResult(jobId);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("Analysis polling timed out");
}
