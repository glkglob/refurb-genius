/**
 * Strict pure parser for B1 catalogue MANIFEST envelopes.
 * No filesystem or Node builtins.
 */

import {
  B1_LICENCE_STATUSES,
  B1_MANIFEST_VERSION,
  B1_NORMALISER_VERSION,
  B1_TRANSFORMATION_SCHEMA_VERSION,
  type B1LicenceStatus,
  type CatalogueManifest,
  type DryRunIssue,
} from "./manifestTypes";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(
  code: DryRunIssue["code"],
  cls: DryRunIssue["class"],
  path: string,
  message: string,
): DryRunIssue {
  return { code, class: cls, path, message };
}

function asNonEmptyString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (t === "" || t.length > max) return null;
  return t;
}

function isIsoDateOnly(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

/** Allowed top-level keys (camelCase and approved snake_case). */
const TOP_KEYS = new Set([
  "manifestVersion",
  "manifest_version",
  "catalogRevision",
  "catalog_revision",
  "source",
  "transformation",
  "package",
]);

const SOURCE_KEYS = new Set([
  "id",
  "name",
  "version",
  "effectiveDate",
  "effective_date",
  "retrievedAt",
  "retrieved_at",
  "licenceReference",
  "licence_reference",
  "licenceStatus",
  "licence_status",
]);

const TRANSFORMATION_KEYS = new Set([
  "schemaVersion",
  "schema_version",
  "normaliserVersion",
  "normaliser_version",
]);

const PACKAGE_KEYS = new Set(["snapshotPath", "snapshot_path", "production"]);

/**
 * At most one accepted alias may be present for a logical field.
 * Dual camelCase/snake_case (even with identical values) is rejected.
 */
function pickExclusive(
  obj: Record<string, unknown>,
  aliases: readonly string[],
  logicalPath: string,
  issues: DryRunIssue[],
): unknown {
  const present = aliases.filter((key) => Object.prototype.hasOwnProperty.call(obj, key));
  if (present.length > 1) {
    issues.push(
      issue(
        "AMBIGUOUS_FIELD_ALIAS",
        "structural",
        logicalPath,
        `ambiguous field aliases: ${present.join(", ")}`,
      ),
    );
    return undefined;
  }
  if (present.length === 1) {
    return obj[present[0]!];
  }
  return undefined;
}

function rejectUnknown(
  obj: Record<string, unknown>,
  allowed: Set<string>,
  path: string,
  issues: DryRunIssue[],
): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      issues.push(
        issue("MANIFEST_UNKNOWN_KEY", "structural", `${path}.${key}`, `unknown key ${key}`),
      );
    }
  }
}

export type ParseCatalogueManifestResult =
  | { ok: true; manifest: CatalogueManifest }
  | { ok: false; issues: DryRunIssue[] };

/**
 * Parse a raw JSON string or already-decoded object into a CatalogueManifest.
 */
export function parseCatalogueManifest(input: string | unknown): ParseCatalogueManifestResult {
  const issues: DryRunIssue[] = [];

  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input) as unknown;
    } catch {
      return {
        ok: false,
        issues: [issue("JSON_PARSE_INVALID", "structural", "manifest", "manifest JSON is invalid")],
      };
    }
  }

  if (!isPlainObject(raw)) {
    return {
      ok: false,
      issues: [
        issue("MANIFEST_INVALID", "structural", "manifest", "manifest must be a non-null object"),
      ],
    };
  }

  rejectUnknown(raw, TOP_KEYS, "manifest", issues);

  const manifestVersionRaw = pickExclusive(
    raw,
    ["manifestVersion", "manifest_version"],
    "manifest.manifestVersion",
    issues,
  );
  if (manifestVersionRaw !== B1_MANIFEST_VERSION) {
    if (typeof manifestVersionRaw === "string" && manifestVersionRaw !== B1_MANIFEST_VERSION) {
      issues.push(
        issue(
          "MANIFEST_VERSION_UNSUPPORTED",
          "unsupported",
          "manifest.manifestVersion",
          `unsupported manifest_version ${manifestVersionRaw}`,
        ),
      );
    } else {
      issues.push(
        issue(
          "MANIFEST_FIELD_INVALID",
          "structural",
          "manifest.manifestVersion",
          'manifestVersion must be "1"',
        ),
      );
    }
  }

  const catalogRevision = asNonEmptyString(
    pickExclusive(raw, ["catalogRevision", "catalog_revision"], "manifest.catalogRevision", issues),
    64,
  );
  if (catalogRevision == null) {
    issues.push(
      issue(
        "MANIFEST_FIELD_INVALID",
        "structural",
        "manifest.catalogRevision",
        "catalogRevision is required",
      ),
    );
  }

  const sourceRaw = raw.source;
  if (!isPlainObject(sourceRaw)) {
    issues.push(
      issue("MANIFEST_FIELD_INVALID", "structural", "manifest.source", "source is required"),
    );
  } else {
    rejectUnknown(sourceRaw, SOURCE_KEYS, "manifest.source", issues);
  }

  const transformationRaw = raw.transformation;
  if (!isPlainObject(transformationRaw)) {
    issues.push(
      issue(
        "MANIFEST_FIELD_INVALID",
        "structural",
        "manifest.transformation",
        "transformation is required",
      ),
    );
  } else {
    rejectUnknown(transformationRaw, TRANSFORMATION_KEYS, "manifest.transformation", issues);
  }

  const packageRaw = raw.package;
  if (!isPlainObject(packageRaw)) {
    issues.push(
      issue("MANIFEST_FIELD_INVALID", "structural", "manifest.package", "package is required"),
    );
  } else {
    rejectUnknown(packageRaw, PACKAGE_KEYS, "manifest.package", issues);
  }

  let sourceId: string | null = null;
  let sourceName: string | null = null;
  let sourceVersion: string | null = null;
  let effectiveDate: string | null = null;
  let retrievedAt: string | undefined;
  let licenceReference: string | null = null;
  let licenceStatus: B1LicenceStatus | null = null;

  if (isPlainObject(sourceRaw)) {
    sourceId = asNonEmptyString(sourceRaw.id, 100);
    if (sourceId == null) {
      issues.push(
        issue(
          "MANIFEST_FIELD_INVALID",
          "structural",
          "manifest.source.id",
          "source.id is required",
        ),
      );
    }
    sourceName = asNonEmptyString(sourceRaw.name, 200);
    if (sourceName == null) {
      issues.push(
        issue(
          "MANIFEST_FIELD_INVALID",
          "structural",
          "manifest.source.name",
          "source.name is required",
        ),
      );
    }
    sourceVersion = asNonEmptyString(sourceRaw.version, 64);
    if (sourceVersion == null) {
      issues.push(
        issue(
          "MANIFEST_FIELD_INVALID",
          "structural",
          "manifest.source.version",
          "source.version is required",
        ),
      );
    }
    const ed = asNonEmptyString(
      pickExclusive(
        sourceRaw,
        ["effectiveDate", "effective_date"],
        "manifest.source.effectiveDate",
        issues,
      ),
      32,
    );
    if (ed == null || !isIsoDateOnly(ed)) {
      issues.push(
        issue(
          "MANIFEST_FIELD_INVALID",
          "structural",
          "manifest.source.effectiveDate",
          "source.effectiveDate must be YYYY-MM-DD",
        ),
      );
    } else {
      effectiveDate = ed;
    }

    const ra = pickExclusive(
      sourceRaw,
      ["retrievedAt", "retrieved_at"],
      "manifest.source.retrievedAt",
      issues,
    );
    if (ra !== undefined) {
      if (typeof ra !== "string" || ra.trim() === "") {
        issues.push(
          issue(
            "MANIFEST_FIELD_INVALID",
            "structural",
            "manifest.source.retrievedAt",
            "source.retrievedAt must be a non-empty string when present",
          ),
        );
      } else {
        retrievedAt = ra.trim();
      }
    }

    licenceReference = asNonEmptyString(
      pickExclusive(
        sourceRaw,
        ["licenceReference", "licence_reference"],
        "manifest.source.licenceReference",
        issues,
      ),
      500,
    );
    if (licenceReference == null) {
      issues.push(
        issue(
          "MANIFEST_FIELD_INVALID",
          "structural",
          "manifest.source.licenceReference",
          "source.licenceReference is required",
        ),
      );
    }

    const ls = pickExclusive(
      sourceRaw,
      ["licenceStatus", "licence_status"],
      "manifest.source.licenceStatus",
      issues,
    );
    if (typeof ls !== "string" || !(B1_LICENCE_STATUSES as readonly string[]).includes(ls)) {
      issues.push(
        issue(
          "LICENCE_STATUS_INVALID",
          "policy",
          "manifest.source.licenceStatus",
          'licenceStatus must be "synthetic" or "rights_unverified"',
        ),
      );
    } else {
      licenceStatus = ls as B1LicenceStatus;
    }
  }

  let transformSchema: string | null = null;
  let normaliserVersion: string | null = null;
  if (isPlainObject(transformationRaw)) {
    transformSchema = asNonEmptyString(
      pickExclusive(
        transformationRaw,
        ["schemaVersion", "schema_version"],
        "manifest.transformation.schemaVersion",
        issues,
      ),
      64,
    );
    if (transformSchema == null) {
      issues.push(
        issue(
          "MANIFEST_FIELD_INVALID",
          "structural",
          "manifest.transformation.schemaVersion",
          "transformation.schemaVersion is required",
        ),
      );
    } else if (transformSchema !== B1_TRANSFORMATION_SCHEMA_VERSION) {
      issues.push(
        issue(
          "MANIFEST_VERSION_UNSUPPORTED",
          "unsupported",
          "manifest.transformation.schemaVersion",
          `unsupported transformation.schemaVersion ${transformSchema}`,
        ),
      );
    }

    normaliserVersion = asNonEmptyString(
      pickExclusive(
        transformationRaw,
        ["normaliserVersion", "normaliser_version"],
        "manifest.transformation.normaliserVersion",
        issues,
      ),
      64,
    );
    if (normaliserVersion == null) {
      issues.push(
        issue(
          "MANIFEST_FIELD_INVALID",
          "structural",
          "manifest.transformation.normaliserVersion",
          "transformation.normaliserVersion is required",
        ),
      );
    } else if (normaliserVersion !== B1_NORMALISER_VERSION) {
      issues.push(
        issue(
          "NORMALISER_VERSION_UNSUPPORTED",
          "unsupported",
          "manifest.transformation.normaliserVersion",
          `unsupported normaliserVersion ${normaliserVersion}`,
        ),
      );
    }
  }

  let snapshotPath: string | null = null;
  let production: boolean | null = null;
  if (isPlainObject(packageRaw)) {
    const sp = pickExclusive(
      packageRaw,
      ["snapshotPath", "snapshot_path"],
      "manifest.package.snapshotPath",
      issues,
    );
    if (typeof sp !== "string" || sp.trim() === "") {
      issues.push(
        issue(
          "MANIFEST_FIELD_INVALID",
          "structural",
          "manifest.package.snapshotPath",
          "package.snapshotPath is required",
        ),
      );
    } else {
      snapshotPath = sp.trim();
    }
    if (typeof packageRaw.production !== "boolean") {
      issues.push(
        issue(
          "MANIFEST_FIELD_INVALID",
          "structural",
          "manifest.package.production",
          "package.production must be a boolean",
        ),
      );
    } else {
      production = packageRaw.production;
    }
  }

  // B1 policy: production always blocked; synthetic requires production false
  if (production === true) {
    issues.push(
      issue(
        "PRODUCTION_BLOCKED",
        "policy",
        "manifest.package.production",
        "production packages are blocked in B1 dry-run tooling",
      ),
    );
  }
  if (licenceStatus === "synthetic" && production === true) {
    // already blocked above; keep single PRODUCTION_BLOCKED
  }
  if (licenceStatus === "synthetic" && production === false) {
    // ok
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  if (
    catalogRevision == null ||
    sourceId == null ||
    sourceName == null ||
    sourceVersion == null ||
    effectiveDate == null ||
    licenceReference == null ||
    licenceStatus == null ||
    transformSchema == null ||
    normaliserVersion == null ||
    snapshotPath == null ||
    production == null
  ) {
    return {
      ok: false,
      issues: [issue("MANIFEST_INVALID", "structural", "manifest", "internal manifest parse gap")],
    };
  }

  const manifest: CatalogueManifest = {
    manifestVersion: B1_MANIFEST_VERSION,
    catalogRevision,
    source: {
      id: sourceId,
      name: sourceName,
      version: sourceVersion,
      effectiveDate,
      ...(retrievedAt !== undefined ? { retrievedAt } : {}),
      licenceReference,
      licenceStatus,
    },
    transformation: {
      schemaVersion: transformSchema,
      normaliserVersion,
    },
    package: {
      snapshotPath,
      production,
    },
  };

  return { ok: true, manifest };
}
