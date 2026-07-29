/**
 * Presentation-safe AIEstimateBuilder save orchestration (AO-1L1).
 *
 * Owns:
 * - empty-room guard + toast
 * - pure payload construction via buildAIEstimateBuilderSaveInput
 * - mutate invocation through useSaveAIEstimate
 * - success toast + onSaved(estimateId) ordering
 * - error toast
 * - isPending passthrough
 *
 * Persistence + AO-1K1 cache invalidation: useSaveAIEstimate (unchanged).
 * Does not own generation, pricing preview, room CRUD, QueryClient, or repository.
 */
import { useCallback } from "react";
import { toast } from "sonner";
import {
  buildAIEstimateBuilderSaveInput,
  type AIEstimateBuilderSaveRoom,
} from "../../application/buildAIEstimateBuilderSaveInput";
import { useSaveAIEstimate } from "./useEstimate";

export type UseAIEstimateBuilderSaveOptions = {
  projectId: string;
  onSaved?: (estimateId: string) => void;
};

export type SaveAIEstimateBuilderSnapshot = {
  propertyType: string;
  bedrooms: number;
  region: string;
  rooms: AIEstimateBuilderSaveRoom[];
  notes: string;
  multiplier: number;
  totals: {
    subtotal: number;
    vat_amount: number;
    total: number;
  };
};

export type UseAIEstimateBuilderSaveResult = {
  saveEstimate: (snapshot: SaveAIEstimateBuilderSnapshot) => void;
  isPending: boolean;
};

export function useAIEstimateBuilderSave(
  options: UseAIEstimateBuilderSaveOptions,
): UseAIEstimateBuilderSaveResult {
  const { projectId, onSaved } = options;
  const save = useSaveAIEstimate();

  const saveEstimate = useCallback(
    (snapshot: SaveAIEstimateBuilderSnapshot) => {
      if (snapshot.rooms.length === 0) {
        toast.error("Generate or add rooms first");
        return;
      }

      const input = buildAIEstimateBuilderSaveInput({
        projectId,
        propertyType: snapshot.propertyType,
        bedrooms: snapshot.bedrooms,
        region: snapshot.region,
        rooms: snapshot.rooms,
        notes: snapshot.notes,
        multiplier: snapshot.multiplier,
        totals: snapshot.totals,
      });

      save.mutate(input, {
        onSuccess: (result) => {
          toast.success("Estimate saved");
          onSaved?.(result.estimate.id);
        },
        onError: (err) => {
          toast.error(err.message || "Failed to save estimate");
        },
      });
    },
    [projectId, onSaved, save],
  );

  return {
    saveEstimate,
    isPending: save.isPending,
  };
}
