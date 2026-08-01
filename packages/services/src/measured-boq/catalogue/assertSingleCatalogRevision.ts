/**
 * Pure mixed-revision gate for authority-intended measured-BOQ commands.
 * Rejects more than one distinct library catalogRevision.
 */

import type { MeasuredBoqEngineInput, MeasuredBoqLibraryRate } from "../measuredBoqEngine";

export type MixedCatalogRevisionResult =
  | { ok: true; catalogRevision: string }
  | {
      ok: false;
      code: "MIXED_CATALOG_REVISIONS" | "MISSING_LIBRARY_REVISION" | "NON_LIBRARY_AUTHORITY_RATE";
      message: string;
      revisions: string[];
    };

/**
 * Collect library catalogRevision values from a measured-BOQ input and require
 * exactly one common revision for initial library-only authority.
 *
 * Non-library rate sources make the command ineligible for canonical authority
 * under the initial 4C2 contract (user-quote deferred).
 */
export function assertSingleCatalogRevision(
  input: MeasuredBoqEngineInput,
): MixedCatalogRevisionResult {
  const revisions = new Set<string>();
  let sawLibrary = false;

  for (const room of input.rooms ?? []) {
    for (const item of room.items ?? []) {
      const rate = item.rate;
      if (!rate || typeof rate !== "object" || !("source" in rate)) {
        return {
          ok: false,
          code: "NON_LIBRARY_AUTHORITY_RATE",
          message: "Authority commands require library rate sources only",
          revisions: [],
        };
      }
      if (rate.source !== "library") {
        return {
          ok: false,
          code: "NON_LIBRARY_AUTHORITY_RATE",
          message: `Rate source "${rate.source}" is not eligible for initial measured-BOQ authority`,
          revisions: [...revisions],
        };
      }
      sawLibrary = true;
      const library = rate as MeasuredBoqLibraryRate;
      if (typeof library.catalogRevision !== "string" || library.catalogRevision.trim() === "") {
        return {
          ok: false,
          code: "MISSING_LIBRARY_REVISION",
          message: "Library rate requires catalogRevision",
          revisions: [...revisions],
        };
      }
      revisions.add(library.catalogRevision);
    }
  }

  if (!sawLibrary || revisions.size === 0) {
    return {
      ok: false,
      code: "MISSING_LIBRARY_REVISION",
      message: "At least one library catalogRevision is required",
      revisions: [],
    };
  }

  if (revisions.size > 1) {
    return {
      ok: false,
      code: "MIXED_CATALOG_REVISIONS",
      message: "Initial measured-BOQ authority requires exactly one catalogue revision",
      revisions: [...revisions].sort(),
    };
  }

  return { ok: true, catalogRevision: [...revisions][0]! };
}
