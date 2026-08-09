/**
 * PUBLIC-BETA-R1 — Project card/list refurbishment amount presentation.
 *
 * Cards receive only Project fields (GDV / purchase). They do NOT receive
 * current Estimate authority amount. The legacy helper estimatedRefurbCost
 * (15% of estimated_gdv) must not be shown as a bare "£N refurb" figure —
 * that implies a calculated/current Estimate when none is available.
 *
 * When a future consumer supplies a trustworthy Estimate amount through an
 * explicit presentation prop, extend this helper. Do not invent amounts from GDV.
 */
import type { Project } from "./types";

export type ProjectCardRefurbPresentation = {
  /** Always non-numeric until cards receive Estimate authority amount. */
  mode: "no_estimate";
  /** Customer-facing status; never implies £0 or a live Estimate. */
  label: string;
};

/**
 * Presentation for Dashboard / Projects continuation cards.
 * Project is accepted for a stable call site; amount is not derived from it.
 */
export function projectCardRefurbPresentation(_project: Project): ProjectCardRefurbPresentation {
  return {
    mode: "no_estimate",
    label: "No estimate yet",
  };
}
