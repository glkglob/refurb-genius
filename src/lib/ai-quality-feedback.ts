// Lightweight AI quality feedback capture.
// Allows admins/beta users to mark Vision and Redesign outputs as accurate/useful.
// Persists feedback using existing Supabase patterns only.
// Note: ai_quality_feedback table is optional for controlled-beta phase.

import { supabase } from "@/integrations/supabase/client";

export type VisionAccuracy = "accurate" | "partial" | "inaccurate";
export type RedesignUsability = "useful" | "generic" | "unrealistic";

export interface AIQualityFeedback {
  id: string;
  project_id: string;
  photo_id: string;
  feedback_type: "vision" | "redesign";
  accuracy?: VisionAccuracy;
  usability?: RedesignUsability;
  notes?: string;
  created_at: string;
}

export async function submitVisionFeedback(
  projectId: string,
  photoId: string,
  accuracy: VisionAccuracy,
  notes?: string,
): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (supabase.from("ai_quality_feedback") as any).insert([
      {
        project_id: projectId,
        photo_id: photoId,
        feedback_type: "vision",
        accuracy,
        notes,
        created_at: new Date().toISOString(),
      },
    ]);

    if (result?.error) {
      console.warn("[AI Quality] Vision feedback insert failed:", result.error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[AI Quality] Vision feedback error (table may not exist yet):", err);
    return false;
  }
}

export async function submitRedesignFeedback(
  projectId: string,
  photoId: string,
  usability: RedesignUsability,
  notes?: string,
): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (supabase.from("ai_quality_feedback") as any).insert([
      {
        project_id: projectId,
        photo_id: photoId,
        feedback_type: "redesign",
        usability,
        notes,
        created_at: new Date().toISOString(),
      },
    ]);

    if (result?.error) {
      console.warn("[AI Quality] Redesign feedback insert failed:", result.error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[AI Quality] Redesign feedback error (table may not exist yet):", err);
    return false;
  }
}

export async function getFeedbackSummary(): Promise<{
  visionAccurate: number;
  visionPartial: number;
  visionInaccurate: number;
  redesignUseful: number;
  redesignGeneric: number;
  redesignUnrealistic: number;
}> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (supabase.from("ai_quality_feedback") as any)
      .select("*")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const feedback = result?.data;
    const error = result?.error;

    if (error || !feedback) {
      console.warn("[AI Quality] Could not load feedback summary (table may not exist):", error?.message);
      return {
        visionAccurate: 0,
        visionPartial: 0,
        visionInaccurate: 0,
        redesignUseful: 0,
        redesignGeneric: 0,
        redesignUnrealistic: 0,
      };
    }

    const summary = {
      visionAccurate: 0,
      visionPartial: 0,
      visionInaccurate: 0,
      redesignUseful: 0,
      redesignGeneric: 0,
      redesignUnrealistic: 0,
    };

    feedback?.forEach((item: Record<string, unknown>) => {
      if (item.feedback_type === "vision") {
        if (item.accuracy === "accurate") summary.visionAccurate++;
        if (item.accuracy === "partial") summary.visionPartial++;
        if (item.accuracy === "inaccurate") summary.visionInaccurate++;
      } else if (item.feedback_type === "redesign") {
        if (item.usability === "useful") summary.redesignUseful++;
        if (item.usability === "generic") summary.redesignGeneric++;
        if (item.usability === "unrealistic") summary.redesignUnrealistic++;
      }
    });

    return summary;
  } catch (err) {
    console.warn("[AI Quality] Feedback summary error (table may not exist):", err);
    return {
      visionAccurate: 0,
      visionPartial: 0,
      visionInaccurate: 0,
      redesignUseful: 0,
      redesignGeneric: 0,
      redesignUnrealistic: 0,
    };
  }
}
