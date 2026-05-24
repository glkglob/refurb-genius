import { supabase } from "@/services/supabase";
import type { Tables } from "@/integrations/supabase/types";
import type {
  TradesJob,
  TradesJobCategory,
  TradesJobStatus,
  CreateTradesJobInput,
  UpdateTradesJobInput,
} from "@/core/trades";

type TradesJobRow = Tables<"trades_jobs">;

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

export async function getTradesJobById(id: string): Promise<TradesJob | null> {
  const { data, error } = await table().select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToJob(data as TradesJobRow);
}

export async function listTradesJobs(): Promise<TradesJob[]> {
  const { data, error } = await table().select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as TradesJobRow[]).map(rowToJob);
}

export async function listPostedTradesJobs(category?: string): Promise<TradesJob[]> {
  let query = table().select("*").eq("status", "posted").order("created_at", { ascending: false });
  if (category) query = query.eq("job_category", category);
  const { data, error } = await query;
  if (error) throw new Error(`listPostedTradesJobs: ${error.message}`);
  return (data as TradesJobRow[]).map(rowToJob);
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
