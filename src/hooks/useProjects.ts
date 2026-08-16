import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import type { NewProjectInput } from "@/core/projects/domain";
import { createProjectForClient } from "@/features/projects/infrastructure/createProjectForClient";
import {
  projectKeys,
  projectsListQueryOptions,
  projectQueryOptions,
  seedProjectDetailCache,
} from "@/lib/queries/projects";

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
     * Web: createProjectServerFn (cookie requireUser + server insert).
     * Native: createProjectNative (Keychain getUser + RLS insert).
     * user_id is never taken from the payload on either path.
     *
     * C4c-3: onSuccess seeds projectKeys.byId and invalidates the list with exact: true
     * so nested Project resource queries are not broadly refetched.
     */
    mutationFn: (input: NewProjectInput) => createProjectForClient(input),
    onSuccess: (project) => {
      seedProjectDetailCache(queryClient, project);
      queryClient.invalidateQueries({ queryKey: projectKeys.all, exact: true });
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
