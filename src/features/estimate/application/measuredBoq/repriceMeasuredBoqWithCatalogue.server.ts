/**
 * Server-only measured-BOQ catalogue reader composition (Ticket 4C2D-B).
 *
 * Flow:
 *   assertSingleCatalogRevision(input)
 *     → loadMeasuredBoqCatalogueSnapshot({ catalogRevision, purpose })
 *     → repriceMeasuredBoq(input, { resolveLibraryRate })
 *
 * - No persistence, UI, routes, ROI, or formula changes
 * - Exact revision only (never latest/current)
 * - Mixed revisions rejected before any catalogue IO
 * - Not exported from browser-safe barrels
 */

import { assertSingleCatalogRevision, type MeasuredBoqEngineInput } from "@repo/services";

import {
  CatalogueLoadError,
  loadMeasuredBoqCatalogueSnapshot,
  type CatalogueLoadErrorCode,
  type CatalogueLoadPurpose,
  type LoadedCatalogueSnapshot,
} from "../../infrastructure/catalogue/measuredBoqCatalogue.repository.server";
import { repriceMeasuredBoq, type RepriceMeasuredBoqResult } from "../repriceMeasuredBoq";

export type RepriceMeasuredBoqWithCataloguePurpose = CatalogueLoadPurpose;

/** Codes from pure {@link assertSingleCatalogRevision} gate failures. */
export type MixedRevisionFailureCode =
  | "MIXED_CATALOG_REVISIONS"
  | "MISSING_LIBRARY_REVISION"
  | "NON_LIBRARY_AUTHORITY_RATE";

export type RepriceMeasuredBoqWithCatalogueErrorCode =
  | MixedRevisionFailureCode
  | CatalogueLoadErrorCode;

export type RepriceMeasuredBoqWithCatalogueSuccess = {
  ok: true;
  purpose: CatalogueLoadPurpose;
  catalogRevision: string;
  contentChecksum: string;
  catalogueStatus: LoadedCatalogueSnapshot["status"];
  entryCount: number;
  reprice: RepriceMeasuredBoqResult;
};

export type RepriceMeasuredBoqWithCatalogueFailure = {
  ok: false;
  error: {
    code: RepriceMeasuredBoqWithCatalogueErrorCode;
    message: string;
    /** Present for mixed-revision gate failures. */
    revisions?: string[];
  };
};

export type RepriceMeasuredBoqWithCatalogueResult =
  | RepriceMeasuredBoqWithCatalogueSuccess
  | RepriceMeasuredBoqWithCatalogueFailure;

/**
 * Canonical catalogue snapshot loader signature used by production and tests.
 * Production defaults to {@link loadMeasuredBoqCatalogueSnapshot}.
 */
export type MeasuredBoqCatalogueSnapshotLoader = (input: {
  catalogRevision: string;
  purpose: CatalogueLoadPurpose;
}) => Promise<LoadedCatalogueSnapshot>;

export type RepriceMeasuredBoqWithCatalogueDeps = {
  /**
   * Optional injection for unit tests. Production path uses the 4C2C
   * server-only repository loader (exact revision, purpose-gated).
   */
  loadCatalogueSnapshot?: MeasuredBoqCatalogueSnapshotLoader;
};

export type RepriceMeasuredBoqWithCatalogueInput = {
  input: MeasuredBoqEngineInput;
  purpose: CatalogueLoadPurpose;
};

/**
 * Reprice a library-identity measured-BOQ input using one exact catalogue
 * revision loaded through the 4C2C server-only repository.
 *
 * Does not persist, recompute money, or fall back to category/trade rates.
 */
export async function repriceMeasuredBoqWithCatalogue(
  command: RepriceMeasuredBoqWithCatalogueInput,
  deps: RepriceMeasuredBoqWithCatalogueDeps = {},
): Promise<RepriceMeasuredBoqWithCatalogueResult> {
  // 1. Revision gate — pure, no database IO.
  const gate = assertSingleCatalogRevision(command.input);
  if (!gate.ok) {
    return {
      ok: false,
      error: {
        code: gate.code,
        message: gate.message,
        revisions: gate.revisions,
      },
    };
  }

  const catalogRevision = gate.catalogRevision;
  const purpose = command.purpose;
  const load =
    deps.loadCatalogueSnapshot ??
    ((args: { catalogRevision: string; purpose: CatalogueLoadPurpose }) =>
      loadMeasuredBoqCatalogueSnapshot({
        catalogRevision: args.catalogRevision,
        purpose: args.purpose,
      }));

  // 2. Exact revision + purpose load (canonical 4C2C repository).
  let snapshot: LoadedCatalogueSnapshot;
  try {
    snapshot = await load({
      catalogRevision,
      purpose,
    });
  } catch (err) {
    if (err instanceof CatalogueLoadError) {
      return {
        ok: false,
        error: {
          code: err.code,
          message: err.message,
        },
      };
    }
    throw err;
  }

  // 3. Pure reprice with injected synchronous resolver only.
  const reprice = repriceMeasuredBoq(command.input, {
    resolveLibraryRate: snapshot.resolveLibraryRate,
  });

  return {
    ok: true,
    purpose,
    catalogRevision: snapshot.catalogRevision,
    contentChecksum: snapshot.contentChecksum,
    catalogueStatus: snapshot.status,
    entryCount: snapshot.entryCount,
    reprice,
  };
}

export { CatalogueLoadError };
export type { CatalogueLoadErrorCode, CatalogueLoadPurpose, LoadedCatalogueSnapshot };
