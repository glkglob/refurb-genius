import { supabase } from "@/platform/supabase/browser";
import type { Tables } from "@repo/supabase";
import type {
  TradesJob,
  PublicTradesJob,
  TradesJobCategory,
  TradesJobStatus,
  CreateTradesJobInput,
  UpdateTradesJobInput,
} from "@/core/trades";

type TradesJobRow = Tables<"trades_jobs">;

type PublicPostedJobRpcRow = {
  id: string;
  title: string;
  description: string;
  job_category: string;
  budget_min: number | null;
  budget_max: number | null;
  desired_start_date: string | null;
  property_type: string | null;
  created_at: string;
  outward_postcode: string | null;
};

const table = () => supabase.from("trades_jobs");

function rowToJob(r: TradesJobRow): TradesJob {
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    propertyAddress: r.property_address,
    postcode: r.postcode,
    propertyType: r.property_type,
    jobCategory: r.job_category as TradesJobCategory,
    description: r.description,
    budgetMin: r.budget_min,
    budgetMax: r.budget_max,
    desiredStartDate: r.desired_start_date,
    status: r.status as TradesJobStatus,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function publicRowToJob(r: PublicPostedJobRpcRow): PublicTradesJob {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    jobCategory: r.job_category as TradesJobCategory,
    budgetMin: r.budget_min,
    budgetMax: r.budget_max,
    desiredStartDate: r.desired_start_date,
    propertyType: r.property_type,
    createdAt: r.created_at,
    outwardPostcode: r.outward_postcode,
  };
}

/** Owner-only: list current user's jobs (full private row). */
export async function listCurrentUserTradesJobs(): Promise<TradesJob[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return [];
  const { data, error } = await table()
    .select("*")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listCurrentUserTradesJobs: ${error.message}`);
  return (data as TradesJobRow[]).map(rowToJob);
}

/**
 * Owner base-row read only (RLS). Returns null when not owner or missing.
 * Does not throw on zero rows — public callers fall through to public RPC.
 */
export async function getTradesJobById(id: string): Promise<TradesJob | null> {
  const { data, error } = await table().select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToJob(data as TradesJobRow);
}

/**
 * TRADES-PRIVACY-R1B — public-safe posted job list via SECURITY DEFINER RPC.
 * Never select("*") on trades_jobs for public browse.
 */
export async function listPostedTradesJobs(
  category?: string,
  ids?: string[],
): Promise<PublicTradesJob[]> {
  const { data, error } = await supabase.rpc("list_public_posted_trades_jobs", {
    p_category: category ?? null,
    p_ids: ids && ids.length > 0 ? ids : null,
  });
  if (error) throw new Error(`listPostedTradesJobs: ${error.message}`);
  return ((data ?? []) as PublicPostedJobRpcRow[]).map(publicRowToJob);
}

/**
 * TRADES-PRIVACY-R1B — public-safe posted job detail via SECURITY DEFINER RPC.
 */
export async function getPublicPostedTradesJob(id: string): Promise<PublicTradesJob | null> {
  const { data, error } = await supabase.rpc("get_public_posted_trades_job", {
    p_id: id,
  });
  if (error) throw new Error(`getPublicPostedTradesJob: ${error.message}`);
  const rows = (data ?? []) as PublicPostedJobRpcRow[];
  if (rows.length === 0) return null;
  return publicRowToJob(rows[0]!);
}

/**
 * Viewer resolution for /trades/$jobId:
 * 1) authenticated owner base row (full private location)
 * 2) else public posted projection
 * 3) else null
 */
export async function resolveTradesJobForViewer(
  id: string,
): Promise<
  { kind: "owner"; job: TradesJob } | { kind: "public"; job: PublicTradesJob } | { kind: "none" }
> {
  const { data: userData } = await supabase.auth.getUser();
  if (userData?.user) {
    try {
      const ownerJob = await getTradesJobById(id);
      if (ownerJob && ownerJob.userId === userData.user.id) {
        return { kind: "owner", job: ownerJob };
      }
    } catch {
      // Fall through to public projection on transient owner-read errors.
    }
  }
  const publicJob = await getPublicPostedTradesJob(id);
  if (publicJob) return { kind: "public", job: publicJob };
  return { kind: "none" };
}

export async function createTradesJob(input: CreateTradesJobInput): Promise<TradesJob> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw new Error("You must be signed in to post a job.");
  }
  const { data, error } = await table()
    .insert({
      user_id: userData.user.id,
      title: input.title,
      property_address: input.propertyAddress ?? null,
      postcode: input.postcode ?? null,
      property_type: input.propertyType ?? null,
      job_category: input.jobCategory,
      description: input.description,
      budget_min: input.budgetMin ?? null,
      budget_max: input.budgetMax ?? null,
      desired_start_date: input.desiredStartDate ?? null,
      status: input.status ?? "posted",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToJob(data as TradesJobRow);
}

export async function updateTradesJob(id: string, patch: UpdateTradesJobInput): Promise<TradesJob> {
  const dbPatch: Partial<TradesJobRow> & { updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.propertyAddress !== undefined) dbPatch.property_address = patch.propertyAddress;
  if (patch.postcode !== undefined) dbPatch.postcode = patch.postcode;
  if (patch.propertyType !== undefined) dbPatch.property_type = patch.propertyType;
  if (patch.jobCategory !== undefined) dbPatch.job_category = patch.jobCategory;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.budgetMin !== undefined) dbPatch.budget_min = patch.budgetMin;
  if (patch.budgetMax !== undefined) dbPatch.budget_max = patch.budgetMax;
  if (patch.desiredStartDate !== undefined) dbPatch.desired_start_date = patch.desiredStartDate;
  if (patch.status !== undefined) dbPatch.status = patch.status;

  const { data, error } = await table().update(dbPatch).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return rowToJob(data as TradesJobRow);
}

export async function deleteTradesJob(id: string): Promise<void> {
  const { error } = await table().delete().eq("id", id);
  if (error) throw new Error(error.message);
}
