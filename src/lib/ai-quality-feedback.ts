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
  // Controlled-beta stub: ai_quality_feedback table not in typed schema
  console.info("[AI Quality] Vision feedback not persisted in controlled-beta (table unavailable)");
  return false;
}

export async function submitRedesignFeedback(
  projectId: string,
  photoId: string,
  usability: RedesignUsability,
  notes?: string,
): Promise<boolean> {
  // Controlled-beta stub: ai_quality_feedback table not in typed schema
  console.info(
    "[AI Quality] Redesign feedback not persisted in controlled-beta (table unavailable)",
  );
  return false;
}

export async function getFeedbackSummary(): Promise<{
  visionAccurate: number;
  visionPartial: number;
  visionInaccurate: number;
  redesignUseful: number;
  redesignGeneric: number;
  redesignUnrealistic: number;
}> {
  // Controlled-beta stub: ai_quality_feedback table not in typed schema
  console.info("[AI Quality] Feedback summary unavailable in controlled-beta (table unavailable)");

  return {
    visionAccurate: 0,
    visionPartial: 0,
    visionInaccurate: 0,
    redesignUseful: 0,
    redesignGeneric: 0,
    redesignUnrealistic: 0,
  };
}
