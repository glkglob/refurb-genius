import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { supabase } from "@/services/supabase";
import type { ProjectStage, NewProjectInput } from "@/lib/projects";
import type { UKRegion, PropertyType, ProjectStatus } from "@/lib/projects";

export type ProjectWithProgress = {
  id: string;
  user_id: string;
  name: string;
  address: string;
  postcode: string;
  region: UKRegion;
  property_type: PropertyType;
  bedrooms: number;
  bathrooms: number;
  size_sqm: number;
  purchase_price: number;
  estimated_gdv: number;
  notes: string;
  created_at: string;
  status: ProjectStatus;
  photos_done: boolean;
  analysis_done: boolean;
  estimate_done: boolean;
  report_done: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProject(r: any): ProjectWithProgress {
  return {
    id: r.id,
    user_id: r.user_id,
    name: r.name,
    address: r.address ?? "",
    postcode: r.postcode ?? "",
    region: r.region as UKRegion,
    property_type: r.property_type as PropertyType,
    bedrooms: Number(r.bedrooms ?? 0),
    bathrooms: Number(r.bathrooms ?? 0),
    size_sqm: Number(r.size_sqm ?? 0),
    purchase_price: Number(r.purchase_price ?? 0),
    estimated_gdv: Number(r.estimated_gdv ?? 0),
    notes: r.notes ?? "",
    created_at: r.created_at,
    status: (r.status ?? "Draft") as ProjectStatus,
    photos_done: !!r.photos_done,
    analysis_done: !!r.analysis_done,
    estimate_done: !!r.estimate_done,
    report_done: !!r.report_done,
  };
}

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
    mutationFn: async ({ id, stage, value }: { id: string; stage: ProjectStage; value: boolean }) => {
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
