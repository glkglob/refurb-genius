/**
 * Projects feature — public API.
 *
 * Presentation consumers import stage mutation from here.
 * Infrastructure is intentionally not re-exported.
 * List/detail/create remain on transitional @/hooks/useProjects (out of AO-1M4).
 */
export {
  useSetProjectStage,
  type SetProjectStageVariables,
} from "./presentation/hooks/useSetProjectStage";
