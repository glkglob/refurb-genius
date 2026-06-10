import { useEffect, useMemo, useState } from "react";
import type { ConditionLevel, EstimateCategory, Project } from "@repo/types";
import { generateRedesignConcepts, type RedesignConcept } from "@/features/ai-design";
import { useCreateFeasibilityStudy, useFeasibilityStudies } from "./useFeasibilityStudies";
import type { CreateFeasibilityStudyCommand } from "../../application";
import {
  FEASIBILITY_STAGE_ORDER,
  FeasibilityStage,
  type FeasibilityStudy,
  type FeasibilityStudySnapshot,
} from "../../domain";

const DEFAULT_ESTIMATE_CATEGORIES: EstimateCategory[] = [
  "Kitchen",
  "Bathroom",
  "Flooring",
  "Painting",
  "Electrical",
  "Plumbing",
  "Heating",
  "Roofing",
  "Structural",
  "Damp Treatment",
  "Garden",
  "Windows & Doors",
];

const DRAFT_KEY = "refurb-genius:feasibility:orchestrator";

type SourcePhoto = { id: string; url: string; name: string; size?: number };

type DraftState = {
  projectId: string;
  studyId?: string;
  stage: FeasibilityStage;
  lastSuccessfulStage: FeasibilityStage;
  savedAt: string;
};

type UseFeasibilityOrchestratorArgs = {
  project: Project | null;
  photos: SourcePhoto[];
  requestedStudyId?: string;
};

export function createFeasibilityStudyCommand(
  project: Project,
  photos: SourcePhoto[],
): CreateFeasibilityStudyCommand {
  const propertyCondition: ConditionLevel = project.property_condition ?? "Average";

  return {
    projectId: project.id,
    property: project,
    photos: photos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      name: photo.name,
      size: photo.size,
    })),
    scopeInput: {
      roomTags: [],
      propertyType: project.property_type,
      bedrooms: project.bedrooms,
      bathrooms: project.bathrooms,
      region: project.region,
      notes: project.notes || undefined,
    },
    estimateInput: {
      region: project.region,
      property_condition: propertyCondition,
      finish_quality: "Standard",
      selected_categories: DEFAULT_ESTIMATE_CATEGORIES,
      property_size_sqm: Math.max(project.size_sqm, 1),
    },
    roiInput: {
      purchase_price: project.purchase_price,
      estimated_gdv: project.estimated_gdv,
      rental_income: 0,
      projected_rental_income: undefined,
      holding_costs: Math.round(project.purchase_price * 0.02),
      region: project.region,
      property_condition: propertyCondition,
    },
  };
}

export function useFeasibilityOrchestrator({
  project,
  photos,
  requestedStudyId,
}: UseFeasibilityOrchestratorArgs) {
  const createStudy = useCreateFeasibilityStudy();
  const { data: snapshots = [], isLoading: loadingSnapshots } = useFeasibilityStudies(
    project?.id ?? "",
  );

  const [currentStage, setCurrentStage] = useState<FeasibilityStage>(FeasibilityStage.Upload);
  const [lastSuccessfulStage, setLastSuccessfulStage] = useState<FeasibilityStage>(
    FeasibilityStage.Upload,
  );
  const [autosavedAt, setAutosavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudyId, setSelectedStudyId] = useState<string | undefined>(requestedStudyId);
  const [redesignConcepts, setRedesignConcepts] = useState<RedesignConcept[]>([]);

  useEffect(() => {
    setSelectedStudyId(requestedStudyId);
  }, [requestedStudyId]);

  useEffect(() => {
    if (!project) return;
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as DraftState;
      if (parsed.projectId !== project.id) return;
      setCurrentStage(parsed.stage);
      setLastSuccessfulStage(parsed.lastSuccessfulStage);
      setSelectedStudyId(parsed.studyId);
      setAutosavedAt(new Date(parsed.savedAt));
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, [project]);

  const selectedSnapshot = useMemo((): FeasibilityStudySnapshot | null => {
    if (snapshots.length === 0) return null;
    if (selectedStudyId) {
      return snapshots.find((snapshot) => snapshot.studyId === selectedStudyId) ?? null;
    }
    return snapshots[0] ?? null;
  }, [selectedStudyId, snapshots]);

  useEffect(() => {
    if (!project) return;
    const draft: DraftState = {
      projectId: project.id,
      stage: currentStage,
      lastSuccessfulStage,
      studyId: selectedSnapshot?.studyId,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setAutosavedAt(new Date(draft.savedAt));
  }, [currentStage, lastSuccessfulStage, project, selectedSnapshot?.studyId]);

  useEffect(() => {
    if (!selectedSnapshot) {
      setRedesignConcepts([]);
      return;
    }
    void generateRedesignConcepts({ projectId: selectedSnapshot.projectId })
      .then((concepts) => setRedesignConcepts(concepts))
      .catch(() => setRedesignConcepts([]));
  }, [selectedSnapshot]);

  async function runFullAnalysis() {
    if (!project) throw new Error("Select a project before running analysis.");
    if (photos.length === 0) throw new Error("Upload at least one photo before running analysis.");

    setError(null);
    setCurrentStage(FeasibilityStage.Analysis);

    try {
      const command = createFeasibilityStudyCommand(project, photos);
      const result = await createStudy.mutateAsync(command);
      setSelectedStudyId(result.study.id);
      setLastSuccessfulStage(FeasibilityStage.Export);
      setCurrentStage(FeasibilityStage.Export);

      const concepts = await generateRedesignConcepts({ projectId: project.id });
      setRedesignConcepts(concepts);
      return result.study;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to orchestrate feasibility study.";
      setError(message);
      const fallbackStage =
        lastSuccessfulStage === FeasibilityStage.Upload
          ? FeasibilityStage.Analysis
          : lastSuccessfulStage;
      setCurrentStage(fallbackStage);
      throw err;
    }
  }

  function continueFromCurrentStage() {
    const stageIndex = FEASIBILITY_STAGE_ORDER.indexOf(currentStage);
    const next =
      FEASIBILITY_STAGE_ORDER[Math.min(stageIndex + 1, FEASIBILITY_STAGE_ORDER.length - 1)];
    setCurrentStage(next);
    if (stageIndex >= 0) {
      setLastSuccessfulStage(FEASIBILITY_STAGE_ORDER[Math.max(stageIndex, 0)]);
    }
  }

  function retryFromLastSuccessful() {
    setError(null);
    setCurrentStage(lastSuccessfulStage);
  }

  return {
    stage: currentStage,
    setStage: setCurrentStage,
    lastSuccessfulStage,
    loadingSnapshots,
    isRunning: createStudy.isPending,
    error,
    autosavedAt,
    runFullAnalysis,
    continueFromCurrentStage,
    retryFromLastSuccessful,
    studySnapshot: selectedSnapshot,
    study: (selectedSnapshot?.study ?? null) as FeasibilityStudy | null,
    redesignConcepts,
  };
}
