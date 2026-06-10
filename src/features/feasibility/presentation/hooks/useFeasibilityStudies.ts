import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateFeasibilityStudyCommand } from "../../application";
import { defaultFeasibilityService as feasibilityService } from "../service";
import { trackEvent } from "@/lib/analytics";

export function useFeasibilityStudies(projectId: string) {
  return useQuery({
    queryKey: ["feasibility-studies", projectId],
    queryFn: () => feasibilityService.list(projectId),
    enabled: !!projectId,
  });
}

export function useFeasibilityStudy(studyId?: string) {
  return useQuery({
    queryKey: ["feasibility-study", studyId],
    queryFn: () => {
      if (!studyId) throw new Error("studyId is required.");
      return feasibilityService.load({ studyId });
    },
    enabled: !!studyId,
  });
}

export function useCreateFeasibilityStudy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreateFeasibilityStudyCommand) => feasibilityService.orchestrate(command),
    onSuccess: (result) => {
      trackEvent("study_created", {
        project_id: result.study.projectId,
        study_id: result.study.id,
      });
      void queryClient.invalidateQueries({
        queryKey: ["feasibility-studies", result.study.projectId],
      });
      void queryClient.invalidateQueries({ queryKey: ["feasibility-study", result.study.id] });
    },
  });
}

export function useDuplicateFeasibilityStudy(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (studyId: string) => feasibilityService.duplicate({ studyId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["feasibility-studies", projectId] });
    },
  });
}

export function useArchiveFeasibilityStudy(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (studyId: string) => feasibilityService.archive({ studyId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["feasibility-studies", projectId] });
    },
  });
}

export function useShareFeasibilityStudy(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (studyId: string) => feasibilityService.share({ studyId }),
    onSuccess: () => {
      trackEvent("study_shared", { project_id: projectId });
      void queryClient.invalidateQueries({ queryKey: ["feasibility-studies", projectId] });
    },
  });
}

export function useQueueFeasibilityExport(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (studyId: string) => feasibilityService.queueExport({ studyId }),
    onSuccess: () => {
      trackEvent("report_exported", { surface: "studies" });
      void queryClient.invalidateQueries({ queryKey: ["feasibility-studies", projectId] });
    },
  });
}
