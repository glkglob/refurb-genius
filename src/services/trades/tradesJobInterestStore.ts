import { supabase } from "@/services/supabase";
import { logger } from "@/lib/logger";
import type {
  TradesJobInterest,
  TradesJobInterestStatus,
  TradesJobCategory,
  CreateTradesJobInterestInput,
} from "@/core/trades";

type TradesJobInterestRow = {
  id: string;
  job_id: string;
  user_id: string;
  message: string | null;
  status: string;
  created_at: string;
};

type TradesJobInterestWithJobRow = TradesJobInterestRow & {
  trades_jobs: {
    id: string;
    title: string;
    postcode: string | null;
    job_category: string;
  } | null;
};

export type TradesJobInterestWithJob = TradesJobInterest & {
  jobTitle: string;
  jobPostcode: string | null;
  jobCategory: TradesJobCategory;
};

const table = () => supabase.from("trades_job_interests");

function rowToInterest(r: TradesJobInterestRow): TradesJobInterest {
  return {
    id: r.id,
    jobId: r.job_id,
    userId: r.user_id,
    message: r.message,
    status: r.status as TradesJobInterestStatus,
    createdAt: r.created_at,
  };
}

export async function createTradesJobInterest(
  input: CreateTradesJobInterestInput,
): Promise<TradesJobInterest> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw new Error("You must be signed in to register interest.");
  }
  const { data, error } = await table()
    .insert({
      job_id: input.jobId,
      user_id: userData.user.id,
      message: input.message ?? null,
      status: "pending",
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new Error("You have already registered interest in this job.");
    }
    throw new Error(error.message);
  }

  const interest = rowToInterest(data as TradesJobInterestRow);

  // Fire-and-forget email notification to job owner
  supabase.functions
    .invoke("send-notification-email", {
      body: {
        type: "interest_registered",
        jobId: input.jobId,
        interestUserId: userData.user.id,
        message: input.message,
      },
    })
    .catch((err) => {
      logger.warn("[trades] Failed to send interest_registered notification (non-blocking)", {
        error: String(err),
      });
    });

  return interest;
}

export async function listCurrentUserInterests(): Promise<TradesJobInterest[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return [];
  const { data, error } = await table()
    .select("*")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as TradesJobInterestRow[]).map(rowToInterest);
}

export async function listCurrentUserInterestsWithJobs(): Promise<TradesJobInterestWithJob[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return [];
  const { data, error } = await table()
    .select("*, trades_jobs(id, title, postcode, job_category)")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as TradesJobInterestWithJobRow[]).map((r) => ({
    ...rowToInterest(r),
    jobTitle: r.trades_jobs?.title ?? "Unknown job",
    jobPostcode: r.trades_jobs?.postcode ?? null,
    jobCategory: (r.trades_jobs?.job_category ?? "") as TradesJobCategory,
  }));
}

export async function listJobInterests(jobId: string): Promise<TradesJobInterest[]> {
  const { data, error } = await table()
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as TradesJobInterestRow[]).map(rowToInterest);
}

export async function updateTradesJobInterestStatus(
  interestId: string,
  status: TradesJobInterestStatus,
): Promise<TradesJobInterest> {
  // Fetch the interest first so we have job_id and user_id for notifications
  const { data: existing, error: fetchError } = await table()
    .select("job_id, user_id")
    .eq("id", interestId)
    .single();

  if (fetchError || !existing) {
    throw new Error("Interest not found");
  }

  const { data, error } = await table().update({ status }).eq("id", interestId).select().single();

  if (error) throw new Error(error.message);

  const updated = rowToInterest(data as TradesJobInterestRow);

  // Fire-and-forget notification to the tradesperson (only on accept/reject)
  if (status === "accepted" || status === "rejected") {
    supabase.functions
      .invoke("send-notification-email", {
        body: {
          type: status === "accepted" ? "interest_accepted" : "interest_rejected",
          jobId: existing.job_id,
          interestUserId: existing.user_id,
        },
      })
      .catch((err) => {
        logger.warn(`[trades] Failed to send ${status} notification (non-blocking)`, {
          error: String(err),
        });
      });
  }

  return updated;
}

/** Returns the current user's interest for a specific job, or null if none exists. */
export async function getCurrentUserInterestForJob(
  jobId: string,
): Promise<TradesJobInterest | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return null;
  const { data, error } = await table()
    .select("*")
    .eq("job_id", jobId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToInterest(data as TradesJobInterestRow) : null;
}
