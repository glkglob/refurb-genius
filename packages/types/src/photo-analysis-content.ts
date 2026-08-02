/**
 * Photo-analysis application model and analysis_data mapping (P1B2).
 *
 * Migration-built `public.photo_analysis_results` columns:
 *   id, project_id, photo_id, user_id, analysis_data (jsonb),
 *   confidence, source, created_at, updated_at
 *
 * Historical flat columns (category, condition_report, detected_defects,
 * material_estimates, cost_suggestions, confidence_score) are NOT table
 * columns. They live inside `analysis_data` (and confidence on the row).
 *
 * This module is the single parser/serializer boundary. Presentation and
 * estimate mapping consume the app model, never raw database Json.
 *
 * Domain-pure: no database client imports. Json shape mirrors PostgREST Json.
 */

/** JSON-compatible value (matches generated Database Json without importing it). */
export type PhotoAnalysisJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: PhotoAnalysisJson | undefined }
  | PhotoAnalysisJson[];

// ── Content shapes (evidenced by write path, UI, estimate mapping) ─────────

export type PhotoAnalysisDefect = {
  description: string;
  severity?: string;
  category?: string;
  estimated_cost?: number;
};

export type PhotoAnalysisMaterial = {
  name: string;
  quantity: number;
  unit: string;
  cost_per_unit?: number;
};

export type PhotoAnalysisCostSuggestions = {
  low?: number;
  mid?: number;
  high?: number;
};

/**
 * Structured content stored under analysis_data (snake_case keys match
 * existing application write/UI contracts — DIRECTLY EVIDENCED).
 */
export type PhotoAnalysisContent = {
  category: string | null;
  condition_report: string | null;
  detected_defects: PhotoAnalysisDefect[];
  material_estimates: PhotoAnalysisMaterial[];
  cost_suggestions: PhotoAnalysisCostSuggestions | null;
};

/**
 * Stable application-facing photo analysis model.
 * Independent of tracked-vs-canonical generated type drift.
 */
export type PhotoAnalysisAppModel = {
  id: string;
  project_id: string;
  photo_id: string | null;
  user_id: string;
  source: string;
  created_at: string;
  updated_at: string;
  /** Content fields parsed from analysis_data (or legacy flat columns). */
  category: string | null;
  condition_report: string | null;
  detected_defects: PhotoAnalysisDefect[];
  material_estimates: PhotoAnalysisMaterial[];
  cost_suggestions: PhotoAnalysisCostSuggestions | null;
  /**
   * Confidence 0–1 (or null). Mapped from canonical `confidence` column;
   * legacy alias `confidence_score` accepted when reading drifted rows.
   */
  confidence_score: number | null;
};

/** Empty content defaults. */
export const EMPTY_PHOTO_ANALYSIS_CONTENT: PhotoAnalysisContent = {
  category: null,
  condition_report: null,
  detected_defects: [],
  material_estimates: [],
  cost_suggestions: null,
};

// ── Runtime guards ─────────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Parse a defect object. Requires non-empty string description.
 * Drops invalid entries (malformed-input policy).
 */
function parseDefect(value: unknown): PhotoAnalysisDefect | null {
  if (!isPlainObject(value)) return null;
  const description = asNullableString(value.description);
  if (!description) return null;
  const defect: PhotoAnalysisDefect = { description };
  const severity = asNullableString(value.severity);
  if (severity) defect.severity = severity;
  const category = asNullableString(value.category);
  if (category) defect.category = category;
  const estimated = asOptionalNumber(value.estimated_cost);
  if (estimated !== undefined) defect.estimated_cost = estimated;
  return defect;
}

/**
 * Parse a material estimate. Requires string name.
 * quantity/unit get safe defaults when missing (match estimate mapping).
 */
function parseMaterial(value: unknown): PhotoAnalysisMaterial | null {
  if (!isPlainObject(value)) return null;
  const name = asNullableString(value.name);
  if (!name) return null;
  const quantity = asOptionalNumber(value.quantity);
  const unit = asNullableString(value.unit);
  const material: PhotoAnalysisMaterial = {
    name,
    quantity: quantity ?? 1,
    unit: unit ?? "item",
  };
  const cpu = asOptionalNumber(value.cost_per_unit);
  if (cpu !== undefined) material.cost_per_unit = cpu;
  return material;
}

function parseCostSuggestions(value: unknown): PhotoAnalysisCostSuggestions | null {
  if (!isPlainObject(value)) return null;
  const low = asOptionalNumber(value.low);
  const mid = asOptionalNumber(value.mid);
  const high = asOptionalNumber(value.high);
  if (low === undefined && mid === undefined && high === undefined) return null;
  const out: PhotoAnalysisCostSuggestions = {};
  if (low !== undefined) out.low = low;
  if (mid !== undefined) out.mid = mid;
  if (high !== undefined) out.high = high;
  return out;
}

/**
 * Parse analysis_data Json → domain content.
 *
 * Malformed-input policy:
 * - null / non-object → empty defaults
 * - string fields: only strings preserved; else null
 * - defect/material arrays: keep only structurally valid entries
 * - mixed/non-array → []
 * - cost_suggestions: object with numeric low/mid/high; else null
 *
 * Legacy aliases (SUPPORTED when key is present):
 * - conditionReport → condition_report
 * - detectedDefects → detected_defects
 * - materialEstimates → material_estimates
 * - costSuggestions → cost_suggestions
 */
export function parsePhotoAnalysisContent(
  analysisData: PhotoAnalysisJson | null | undefined,
): PhotoAnalysisContent {
  if (analysisData == null || !isPlainObject(analysisData)) {
    return { ...EMPTY_PHOTO_ANALYSIS_CONTENT };
  }

  const category =
    asNullableString(analysisData.category) ??
    // room is a presentation alias sometimes written into content
    asNullableString(analysisData.room);

  const condition_report =
    asNullableString(analysisData.condition_report) ??
    asNullableString(analysisData.conditionReport);

  const rawDefects = analysisData.detected_defects ?? analysisData.detectedDefects;
  const detected_defects = Array.isArray(rawDefects)
    ? rawDefects.map(parseDefect).filter((d): d is PhotoAnalysisDefect => d !== null)
    : [];

  const rawMaterials = analysisData.material_estimates ?? analysisData.materialEstimates;
  const material_estimates = Array.isArray(rawMaterials)
    ? rawMaterials.map(parseMaterial).filter((m): m is PhotoAnalysisMaterial => m !== null)
    : [];

  const rawCosts = analysisData.cost_suggestions ?? analysisData.costSuggestions;
  const cost_suggestions = parseCostSuggestions(rawCosts);

  return {
    category,
    condition_report,
    detected_defects,
    material_estimates,
    cost_suggestions,
  };
}

/**
 * Serialize application content fields into analysis_data Json.
 * Always writes snake_case keys (canonical application contract).
 * Omits null cost_suggestions as empty object when caller passes {}.
 */
export function serializePhotoAnalysisContent(content: {
  category?: string | null;
  condition_report?: string | null;
  detected_defects?: unknown;
  material_estimates?: unknown;
  cost_suggestions?: unknown;
}): PhotoAnalysisJson {
  const defects = Array.isArray(content.detected_defects)
    ? content.detected_defects
        .map(parseDefect)
        .filter((d): d is PhotoAnalysisDefect => d !== null)
        .map((d) => {
          const o: Record<string, PhotoAnalysisJson> = { description: d.description };
          if (d.severity !== undefined) o.severity = d.severity;
          if (d.category !== undefined) o.category = d.category;
          if (d.estimated_cost !== undefined) o.estimated_cost = d.estimated_cost;
          return o;
        })
    : [];

  const materials = Array.isArray(content.material_estimates)
    ? content.material_estimates
        .map(parseMaterial)
        .filter((m): m is PhotoAnalysisMaterial => m !== null)
        .map((m) => {
          const o: Record<string, PhotoAnalysisJson> = {
            name: m.name,
            quantity: m.quantity,
            unit: m.unit,
          };
          if (m.cost_per_unit !== undefined) o.cost_per_unit = m.cost_per_unit;
          return o;
        })
    : [];

  let cost_suggestions: PhotoAnalysisJson = {};
  if (content.cost_suggestions != null && isPlainObject(content.cost_suggestions)) {
    const parsed = parseCostSuggestions(content.cost_suggestions);
    if (parsed) {
      cost_suggestions = { ...parsed };
    } else {
      cost_suggestions = {};
    }
  }

  const payload: Record<string, PhotoAnalysisJson> = {
    category: content.category ?? null,
    condition_report: content.condition_report ?? null,
    detected_defects: defects,
    material_estimates: materials,
    cost_suggestions,
  };
  return payload;
}

/**
 * Loose DB row shape accepted by the mapper (canonical + legacy flat).
 * Not exported as the public consumer type.
 */
export type PhotoAnalysisDbRowLike = {
  id: string;
  project_id: string;
  photo_id?: string | null;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
  source?: string | null;
  analysis_data?: PhotoAnalysisJson | null;
  confidence?: number | null;
  // Legacy flat columns (tracked types / drifted rows)
  category?: string | null;
  condition_report?: string | null;
  detected_defects?: PhotoAnalysisJson | null;
  material_estimates?: PhotoAnalysisJson | null;
  cost_suggestions?: PhotoAnalysisJson | null;
  confidence_score?: number | null;
};

/**
 * Map a database row (canonical or legacy flat) to the application model.
 *
 * Preference order for content:
 * 1. analysis_data object when present and non-empty of known keys
 * 2. legacy flat columns when analysis_data is absent/empty
 *
 * Confidence: canonical `confidence`, else legacy `confidence_score`.
 */
export function mapPhotoAnalysisRow(row: PhotoAnalysisDbRowLike): PhotoAnalysisAppModel {
  const fromJson = parsePhotoAnalysisContent(row.analysis_data ?? null);
  const hasJsonContent =
    row.analysis_data != null &&
    isPlainObject(row.analysis_data) &&
    (fromJson.category != null ||
      fromJson.condition_report != null ||
      fromJson.detected_defects.length > 0 ||
      fromJson.material_estimates.length > 0 ||
      fromJson.cost_suggestions != null ||
      // empty object still means "canonical path used"
      Object.keys(row.analysis_data).length > 0);

  let content: PhotoAnalysisContent;
  if (hasJsonContent) {
    content = fromJson;
  } else {
    // Legacy flat-column fallback (SUPPORTED LEGACY for drifted rows/tests)
    content = {
      category: asNullableString(row.category),
      condition_report: asNullableString(row.condition_report),
      detected_defects: Array.isArray(row.detected_defects)
        ? row.detected_defects.map(parseDefect).filter((d): d is PhotoAnalysisDefect => d !== null)
        : [],
      material_estimates: Array.isArray(row.material_estimates)
        ? row.material_estimates
            .map(parseMaterial)
            .filter((m): m is PhotoAnalysisMaterial => m !== null)
        : [],
      cost_suggestions: parseCostSuggestions(row.cost_suggestions),
    };
  }

  const confidence = asNullableNumber(row.confidence) ?? asNullableNumber(row.confidence_score);

  return {
    id: row.id,
    project_id: row.project_id,
    photo_id: row.photo_id ?? null,
    user_id: typeof row.user_id === "string" ? row.user_id : "",
    source: typeof row.source === "string" && row.source.length > 0 ? row.source : "ai",
    created_at: row.created_at,
    updated_at: row.updated_at,
    category: content.category,
    condition_report: content.condition_report,
    detected_defects: content.detected_defects,
    material_estimates: content.material_estimates,
    cost_suggestions: content.cost_suggestions,
    confidence_score: confidence,
  };
}

/**
 * Build a factory fixture for tests (application model, not DB row).
 */
export function createPhotoAnalysisAppModel(
  overrides: Partial<PhotoAnalysisAppModel> = {},
): PhotoAnalysisAppModel {
  return {
    id: "analysis-1",
    project_id: "proj-1",
    photo_id: "photo-1",
    user_id: "user-1",
    source: "ai",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    category: "Kitchen",
    condition_report: null,
    detected_defects: [],
    material_estimates: [],
    cost_suggestions: null,
    confidence_score: 0.8,
    ...overrides,
  };
}
