/**
 * Pure B1B catalogue dry-run evaluation pipeline.
 * No filesystem, process/argv, network, or Supabase.
 */

import { computeCatalogueContentChecksum } from "./checksum";
import {
  B1_MANIFEST_VERSION,
  B1_NORMALISER_VERSION,
  type CatalogueDryRunReport,
  type DryRunIssue,
  type RunCatalogueDryRunInput,
  type RunCatalogueDryRunResult,
} from "./manifestTypes";
import { normaliseCatalogueSnapshot } from "./normaliseCatalogueSnapshot";
import { computePackageArtifactChecksum } from "./packageChecksum";
import { parseCatalogueManifest } from "./parseCatalogueManifest";
import { validateCatalogueSnapshot } from "./validateCatalogueSnapshot";

function sortIssues(issues: DryRunIssue[]): DryRunIssue[] {
  return [...issues].sort((a, b) => {
    if (a.path < b.path) return -1;
    if (a.path > b.path) return 1;
    if (a.code < b.code) return -1;
    if (a.code > b.code) return 1;
    const ar = a.rateKey ?? "";
    const br = b.rateKey ?? "";
    if (ar < br) return -1;
    if (ar > br) return 1;
    return 0;
  });
}

function emptyReport(
  partial: Partial<CatalogueDryRunReport> & { inputChecksum: string },
): CatalogueDryRunReport {
  return {
    ok: false,
    mode: "dry-run",
    tool: "catalogue-dry-run",
    manifestVersion: null,
    normaliserVersion: null,
    catalogRevision: null,
    sourceId: null,
    licenceStatus: null,
    production: null,
    recordCount: 0,
    acceptedCount: 0,
    rejectedCount: 0,
    warningCount: 0,
    outputChecksum: null,
    unitAliasApplications: [],
    issues: [],
    warnings: [],
    ...partial,
  };
}

/**
 * Pure dry-run evaluation of raw manifest + snapshot artifact text.
 */
export function runCatalogueDryRun(input: RunCatalogueDryRunInput): RunCatalogueDryRunResult {
  const issues: DryRunIssue[] = [];
  const warnings: DryRunIssue[] = [];

  const inputChecksum = computePackageArtifactChecksum(input.manifestText, input.snapshotText);

  // Optional expected input checksum
  if (input.expectedInputChecksum != null && input.expectedInputChecksum !== inputChecksum) {
    issues.push({
      code: "INPUT_CHECKSUM_MISMATCH",
      class: "checksum",
      path: "inputChecksum",
      message: "expected input checksum does not match recomputed artifact digest",
    });
  }

  // Parse manifest
  const parsedManifest = parseCatalogueManifest(input.manifestText);
  if (!parsedManifest.ok) {
    issues.push(...parsedManifest.issues);
    const report = emptyReport({
      inputChecksum,
      issues: sortIssues(issues),
      rejectedCount: issues.length,
    });
    return { report };
  }

  const manifest = parsedManifest.manifest;

  // Parse snapshot JSON
  let snapshotRaw: unknown;
  try {
    snapshotRaw = JSON.parse(input.snapshotText) as unknown;
  } catch {
    issues.push({
      code: "JSON_PARSE_INVALID",
      class: "structural",
      path: "snapshot",
      message: "snapshot JSON is invalid",
    });
    const report = emptyReport({
      inputChecksum,
      manifestVersion: manifest.manifestVersion,
      normaliserVersion: manifest.transformation.normaliserVersion,
      catalogRevision: manifest.catalogRevision,
      sourceId: manifest.source.id,
      licenceStatus: manifest.source.licenceStatus,
      production: manifest.package.production,
      issues: sortIssues(issues),
      rejectedCount: issues.length,
    });
    return { report };
  }

  // Normalise
  const normalised = normaliseCatalogueSnapshot(snapshotRaw, {
    productionFromManifest: manifest.package.production,
  });

  if (!normalised.ok) {
    issues.push(...normalised.issues);
    const report = emptyReport({
      inputChecksum,
      manifestVersion: manifest.manifestVersion,
      normaliserVersion: manifest.transformation.normaliserVersion,
      catalogRevision: manifest.catalogRevision,
      sourceId: manifest.source.id,
      licenceStatus: manifest.source.licenceStatus,
      production: manifest.package.production,
      recordCount: Array.isArray((snapshotRaw as { entries?: unknown })?.entries)
        ? (snapshotRaw as { entries: unknown[] }).entries.length
        : 0,
      unitAliasApplications: normalised.unitAliasApplications,
      issues: sortIssues(issues),
      rejectedCount: issues.length,
    });
    return { report };
  }

  // Revision equality
  const snapRev = normalised.snapshot.catalogRevision;
  if (typeof snapRev === "string" && snapRev !== manifest.catalogRevision) {
    issues.push({
      code: "REVISION_MISMATCH",
      class: "structural",
      path: "catalogRevision",
      message: "manifest catalogRevision does not match snapshot catalogRevision",
    });
  }

  // Policy: rights_unverified never authorises production/publication (production already blocked).
  if (manifest.source.licenceStatus === "rights_unverified") {
    warnings.push({
      code: "RIGHTS_UNVERIFIED_NOTICE",
      class: "policy",
      path: "manifest.source.licenceStatus",
      message:
        "rights_unverified permits technical dry-run only and does not grant publication or legal approval",
    });
  }

  // Validate catalogue snapshot
  const validated = validateCatalogueSnapshot(normalised.snapshot);
  if (!validated.ok) {
    for (const vi of validated.issues) {
      issues.push({
        code: vi.code,
        class: "semantic",
        path: vi.path.startsWith("entries") ? `snapshot.${vi.path}` : `snapshot.${vi.path}`,
        message: vi.message,
      });
    }
    const report = emptyReport({
      inputChecksum,
      manifestVersion: manifest.manifestVersion,
      normaliserVersion: manifest.transformation.normaliserVersion,
      catalogRevision: manifest.catalogRevision,
      sourceId: manifest.source.id,
      licenceStatus: manifest.source.licenceStatus,
      production: manifest.package.production,
      recordCount: Array.isArray(normalised.snapshot.entries)
        ? (normalised.snapshot.entries as unknown[]).length
        : 0,
      unitAliasApplications: normalised.unitAliasApplications,
      issues: sortIssues(issues),
      warnings: sortIssues(warnings),
      warningCount: warnings.length,
      rejectedCount: issues.length,
    });
    return { report };
  }

  const outputChecksum = validated.contentChecksum;
  // Recompute via exported API for consistency (same as validate)
  const recomputed = computeCatalogueContentChecksum(validated.snapshot);
  if (recomputed !== outputChecksum) {
    issues.push({
      code: "OUTPUT_CHECKSUM_MISMATCH",
      class: "checksum",
      path: "outputChecksum",
      message: "internal content checksum inconsistency",
    });
  }

  if (input.expectedOutputChecksum != null && input.expectedOutputChecksum !== outputChecksum) {
    issues.push({
      code: "OUTPUT_CHECKSUM_MISMATCH",
      class: "checksum",
      path: "outputChecksum",
      message: "expected output checksum does not match recomputed content digest",
    });
  }

  // If any issues accumulated after validation (checksum mismatch), fail
  if (issues.length > 0) {
    const report = emptyReport({
      inputChecksum,
      manifestVersion: manifest.manifestVersion,
      normaliserVersion: manifest.transformation.normaliserVersion,
      catalogRevision: manifest.catalogRevision,
      sourceId: manifest.source.id,
      licenceStatus: manifest.source.licenceStatus,
      production: manifest.package.production,
      recordCount: validated.snapshot.entries.length,
      acceptedCount: 0,
      rejectedCount: issues.length,
      unitAliasApplications: normalised.unitAliasApplications,
      outputChecksum,
      issues: sortIssues(issues),
      warnings: sortIssues(warnings),
      warningCount: warnings.length,
    });
    return { report };
  }

  const entryCount = validated.snapshot.entries.length;
  const report: CatalogueDryRunReport = {
    ok: true,
    mode: "dry-run",
    tool: "catalogue-dry-run",
    manifestVersion: B1_MANIFEST_VERSION,
    normaliserVersion: B1_NORMALISER_VERSION,
    catalogRevision: manifest.catalogRevision,
    sourceId: manifest.source.id,
    licenceStatus: manifest.source.licenceStatus,
    production: manifest.package.production,
    recordCount: entryCount,
    acceptedCount: entryCount,
    rejectedCount: 0,
    warningCount: warnings.length,
    inputChecksum,
    outputChecksum,
    unitAliasApplications: [...normalised.unitAliasApplications].sort((a, b) =>
      a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
    ),
    issues: [],
    warnings: sortIssues(warnings),
  };

  return {
    report,
    contentChecksum: outputChecksum,
    validatedSnapshot: {
      ...validated.snapshot,
      contentChecksum: validated.contentChecksum,
    },
  };
}
