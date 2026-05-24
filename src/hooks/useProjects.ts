import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { supabase } from "@/services/supabase";
import type { ProjectStage, NewProjectInput } from "@/lib/projects";
import { rowToProject, type ProjectWithProgress } from "@/lib/mappers";

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
    mutationFn: async (input: NewProjectInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in.");
      const { data, error } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          name: input.name,
          address: input.address,
          postcode: input.postcode,
          region: input.region,
          property_type: input.property_type,
          bedrooms: input.bedrooms,
          bathrooms: input.bathrooms,
          size_sqm: input.size_sqm,
          purchase_price: input.purchase_price,
          estimated_gdv: input.estimated_gdv,
          notes: input.notes,
          status: "Draft",
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return rowToProject(data);
    },
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
