import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { supabase } from "@/services/supabase";
import type { ProjectStage, NewProjectInput } from "@/lib/projects";
import { rowToProject, type ProjectWithProgress } from "@/lib/mappers";

// NEW: server-side create mutation (SSR + hard-refresh safe).
// Replaces the previous client-only supabase.auth.getUser() + insert.
import { createProjectServerFn } from "@/serverFns/projects";

export type { ProjectWithProgress } from "@/lib/mappers";

async function fetchProjects(): Promise<ProjectWithProgress[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToProject);
}

export function useProjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    enabled: !!user,
  });
}

export function useProject(id: string) {
  const { data: projects, ...rest } = useProjects();
  return {
    ...rest,
    data: projects?.find((p) => p.id === id),
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
     * The rest of the hook (React Query caching, onSuccess invalidation, error
     * handling in the form) is unchanged so the UI in projects.new.tsx continues
     * to work identically.
     */
    mutationFn: (input: NewProjectInput) => createProjectServerFn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

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
      await queryClient.cancelQueries({ queryKey: ["projects"] });
      const previous = queryClient.getQueryData<ProjectWithProgress[]>(["projects"]);
      queryClient.setQueryData<ProjectWithProgress[]>(["projects"], (old) =>
        old?.map((p) => (p.id === id ? { ...p, [`${stage}_done`]: value } : p)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["projects"], context.previous);
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
