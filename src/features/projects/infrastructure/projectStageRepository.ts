/**
 * Project stage progress persistence (AO-1M4).
 *
 * Web: browser pip-auth update of a single *_done column on public.projects.
 * Native: Keychain getNativeSupabase, same RLS update. JIT-refreshes the
 * Keychain session (autoRefreshToken:false) via resolveNativeAccessTokenFromAuth
 * before UPDATE. Fail closed — no write when the token cannot be verified.
 * Ownership enforced by RLS (projects_all_own). No select/return row.
 */
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/platform/supabase/browser";
import type { ProjectStage } from "@/core/projects/domain";
import {
  resolveNativeAccessTokenFromAuth,
  type NativeAccessTokenFailureReason,
} from "@/platform/http/native-access-token";

export interface SetProjectStageDoneInput {
  projectId: string;
  stage: ProjectStage;
  value: boolean;
}

/**
 * Maps workflow stage name → projects table progress column patch.
 * Preserves pre-extraction ternary fall-through for non-matching stages.
 */
function stageColumnPatch(
  stage: ProjectStage,
  value: boolean,
):
  | { photos_done: boolean }
  | { analysis_done: boolean }
  | { estimate_done: boolean }
  | { report_done: boolean } {
  return stage === "photos"
    ? { photos_done: value }
    : stage === "analysis"
      ? { analysis_done: value }
      : stage === "estimate"
        ? { estimate_done: value }
        : { report_done: value };
}

function nativeStageAuthError(reason: NativeAccessTokenFailureReason): Error {
  if (reason === "refresh_failed") {
    return new Error("Your session expired. Sign in again.");
  }
  if (reason === "indeterminate") {
    return new Error("Could not verify your session. Sign in again.");
  }
  return new Error("You must be signed in.");
}

/**
 * Update a single project stage progress flag for the authenticated owner.
 * Preserves pre-extraction table, filter, void return, and error behaviour.
 * Native writes refresh a stale/near-expiry Keychain token first.
 */
export async function setProjectStageDone(input: SetProjectStageDoneInput): Promise<void> {
  const { projectId, stage, value } = input;
  const column = stageColumnPatch(stage, value);
  if (Capacitor.isNativePlatform()) {
    const { getNativeSupabase } = await import("@/platform/supabase/native");
    const client = getNativeSupabase();
    const token = await resolveNativeAccessTokenFromAuth(client.auth);
    if (!token.ok) {
      throw nativeStageAuthError(token.reason);
    }
    const { error } = await client.from("projects").update(column).eq("id", projectId);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase.from("projects").update(column).eq("id", projectId);
  if (error) throw new Error(error.message);
}

export const projectStageRepository = {
  setProjectStageDone,
};
