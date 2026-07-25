import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { supabase } from "@/platform/supabase/browser";
import type { ProjectStage, NewProjectInput } from "@/core/projects/domain";
import {
  projectKeys,
  projectsListQueryOptions,
  projectQueryOptions,
  projectStagePatch,
  applyProjectStageOptimistic,
  restoreProjectStageCaches,
  seedProjectDetailCache,
} from "@/lib/queries/projects";

// NEW: server-side create mutation (SSR + hard-refresh safe).
// Replaces the previous client-only supabase.auth.getUser() + insert.
import { createProjectServerFn } from "@/serverFns/projects";

export type { ProjectWithProgress } from "@/lib/mappers";

/** Dashboard / product Projects list — canonical cache: projectKeys.all (C4c-6). */
export function useProjects() {
  const { user } = useAuth();
  return useQuery({
    ...projectsListQueryOptions(),
    enabled: Boolean(user),
  });
}

/**
 * Single-project detail read (C4c-2).
 *
 * Canonical authority: projectQueryOptions / projectKeys.byId.
 * Hook-layer enabled requires both projectId and authenticated user so
 * unauthenticated/hydrating states stay pending (isLoading → isPending).
 * Missing rows resolve to null (consumers use falsy checks).
 */
export function useProject(id: string) {
  const { user } = useAuth();
  const query = useQuery({
    ...projectQueryOptions(id),
    enabled: Boolean(id && user),
  });
  return {
    ...query,
    // `isLoading` is false while the query is *disabled* (auth still
    // hydrating), which made pages treat "not loaded yet" as "not found"
    // and bounce to /dashboard. `isPending` stays true until we actually
    // have data, so report that instead.
    isLoading: query.isPending,
  };
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    /**
     * THE FIX FOR /projects/new AFTER HARD REFRESH / DIRECT NAV
     *
     * Previously this performed a browser-only `supabase.auth.getUser()` check
     * followed by a direct insert. That always failed with "You must be signed in."
     * on hard refresh because the client Supabase singleton had no session in memory.
     *
     * Now we delegate the entire authenticated insert to `createProjectServerFn`,
     * which:
     *   - runs its handler on the server
     *   - calls `requireUser()` (cookie-validated via the server Supabase client)
     *   - writes the row using the real `user.id` from the validated session
     *
     * C4c-3: onSuccess seeds projectKeys.byId and invalidates the list with exact: true
     * so nested Project resource queries are not broadly refetched.
     */
    mutationFn: (input: NewProjectInput) => createProjectServerFn({ data: input }),
    onSuccess: (project) => {
      seedProjectDetailCache(queryClient, project);
      queryClient.invalidateQueries({ queryKey: projectKeys.all, exact: true });
    },
  });
}

/**
 * Stage progress mutation (C4c-3).
 *
 * Dual-cache optimistic sync: projectKeys.all + projectKeys.byId(id) when detail
 * is already a cached Project. Cancels only exact list/detail keys (not nested).
 * Overlapping stage mutations may still race on rollback (accepted; same class as
 * pre-C4c-3 list-only optimism).
 */
export function useSetProjectStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      stage,
      value,
    }: {
      id: string;
      stage: ProjectStage;
      value: boolean;
    }) => {
      const column =
        stage === "photos"
          ? { photos_done: value }
          : stage === "analysis"
            ? { analysis_done: value }
            : stage === "estimate"
              ? { estimate_done: value }
              : { report_done: value };
      const { error } = await supabase.from("projects").update(column).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onMutate: async ({ id, stage, value }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: projectKeys.all, exact: true }),
        queryClient.cancelQueries({ queryKey: projectKeys.byId(id), exact: true }),
      ]);
      const snapshot = applyProjectStageOptimistic(
        queryClient,
        id,
        projectStagePatch(stage, value),
      );
      return { ...snapshot, id };
    },
    onError: (_err, _vars, context) => {
      if (!context) return;
      restoreProjectStageCaches(queryClient, context.id, {
        previousList: context.previousList,
        previousDetail: context.previousDetail,
      });
    },
  });
}

export function useProjectProgress(id: string) {
  const { data: project } = useProject(id);
  if (!project) {
    return { photos: false, analysis: false, estimate: false, report: false };
  }
  return {
    photos: project.photos_done,
    analysis: project.analysis_done,
    estimate: project.estimate_done,
    report: project.report_done,
  };
}
