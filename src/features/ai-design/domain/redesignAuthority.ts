/**
 * IA-4 — Durable Redesign authority shapes (pure).
 *
 * Persisted in redesign_concepts.payload. Selection is explicit and durable;
 * generation alone never implies selection.
 */
import type { RedesignConcept, RedesignStyle } from "./types";

/** Payload stored in public.redesign_concepts.payload (jsonb). */
export type RedesignConceptPayload = {
  tagline: string;
  palette: { name: string; hex: string }[];
  flooring: string;
  lighting: string;
  furniture: string;
  afterGradient: string;
  afterImageUrl?: string;
  estimatedCostUplift?: { low: number; mid: number; high: number; note?: string };
  /** Durable photo-catalogue identity at generation time (IA-3/IA-4). */
  analysisIdentity: string;
  /** Exactly one selected authority per project at a time (app-enforced). */
  isSelected: boolean;
};

/** Durable row projected for clients. */
export type DurableRedesignConcept = RedesignConcept & {
  id: string;
  analysisIdentity: string;
  isSelected: boolean;
};

export function conceptToPayload(
  concept: RedesignConcept,
  analysisIdentity: string,
  isSelected = false,
): RedesignConceptPayload {
  return {
    tagline: concept.tagline,
    palette: concept.palette,
    flooring: concept.flooring,
    lighting: concept.lighting,
    furniture: concept.furniture,
    afterGradient: concept.afterGradient,
    ...(concept.afterImageUrl ? { afterImageUrl: concept.afterImageUrl } : {}),
    ...(concept.estimatedCostUplift ? { estimatedCostUplift: concept.estimatedCostUplift } : {}),
    analysisIdentity,
    isSelected,
  };
}

export function payloadToConcept(
  style: string,
  payload: RedesignConceptPayload,
  id: string,
): DurableRedesignConcept {
  return {
    id,
    style: style as RedesignStyle,
    tagline: payload.tagline,
    palette: payload.palette ?? [],
    flooring: payload.flooring,
    lighting: payload.lighting,
    furniture: payload.furniture,
    afterGradient: payload.afterGradient,
    ...(payload.afterImageUrl ? { afterImageUrl: payload.afterImageUrl } : {}),
    ...(payload.estimatedCostUplift ? { estimatedCostUplift: payload.estimatedCostUplift } : {}),
    analysisIdentity: payload.analysisIdentity ?? "",
    isSelected: Boolean(payload.isSelected),
  };
}

/** Pure: parse unknown jsonb payload safely. */
export function parseRedesignPayload(raw: unknown): RedesignConceptPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.tagline !== "string") return null;
  if (typeof o.flooring !== "string") return null;
  if (typeof o.lighting !== "string") return null;
  if (typeof o.furniture !== "string") return null;
  if (typeof o.afterGradient !== "string") return null;
  if (typeof o.analysisIdentity !== "string") return null;
  const palette = Array.isArray(o.palette)
    ? o.palette
        .filter(
          (p): p is { name: string; hex: string } =>
            !!p &&
            typeof p === "object" &&
            typeof (p as { name?: unknown }).name === "string" &&
            typeof (p as { hex?: unknown }).hex === "string",
        )
        .map((p) => ({ name: p.name, hex: p.hex }))
    : [];
  return {
    tagline: o.tagline,
    palette,
    flooring: o.flooring,
    lighting: o.lighting,
    furniture: o.furniture,
    afterGradient: o.afterGradient,
    ...(typeof o.afterImageUrl === "string" ? { afterImageUrl: o.afterImageUrl } : {}),
    analysisIdentity: o.analysisIdentity,
    isSelected: Boolean(o.isSelected),
  };
}

/**
 * analysisIdentity from authoritative analyses' durable photo_ids.
 * Empty if no photo_ids (cannot bind).
 */
export function analysisIdentityFromPhotoIds(photoIds: Array<string | null | undefined>): string {
  return [...photoIds]
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .sort()
    .join("\u0001");
}
