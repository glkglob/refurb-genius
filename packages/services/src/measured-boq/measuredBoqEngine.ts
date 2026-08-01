/**
 * Deterministic measured-BOQ financial engine (L3 room/line authority).
 *
 * Separate from category-based runPricingEngine. Does not convert BOQ lines
 * into broad refurbishment categories. Presentation must not recompute these
 * totals for authority-priced results.
 *
 * Library amounts come only from a trusted catalogue dependency — never from
 * the BOQ line payload.
 */
import type { UKRegion } from "@repo/types";

import { CONTINGENCY_RATE, getRegionalMultiplier, VAT_RATE } from "../pricing/pricingEngine";

// ── Policy constants ───────────────────────────────────────────────────────

export const MEASURED_BOQ_POLICY_VERSION = "2026-07-30.1" as const;

/** Same rate as category engine; not caller-overridable. */
export const MEASURED_BOQ_CONTINGENCY_RATE = CONTINGENCY_RATE;
/** Same rate as category engine; not caller-overridable. */
export const MEASURED_BOQ_VAT_RATE = VAT_RATE;

export const MEASURED_BOQ_LOW_FACTOR = 0.85;
export const MEASURED_BOQ_HIGH_FACTOR = 1.15;

// ── Money precision ────────────────────────────────────────────────────────

/** Deterministic two-decimal GBP rounding. */
export function roundMeasuredBoqMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// ── Trusted library catalogue dependency ───────────────────────────────────

export type MeasuredBoqLibraryCatalogEntry = {
  rateKey: string;
  catalogRevision: string;
  baseUnitRate: number;
  currency: "GBP";
  vatBasis: "exclusive";
  /** Canonical unit code — must exactly match the BOQ line unit for library rates. */
  unit: string;
  /** Fixed cost allocation for this catalogue entry. */
  costType: MeasuredBoqCostType;
};

export type MeasuredBoqLibraryRateReference = {
  rateKey: string;
  catalogRevision: string;
};

/**
 * Trusted resolver for library rates. Amounts are never taken from the BOQ
 * line payload — only from this dependency.
 */
export type MeasuredBoqLibraryRateResolver = (
  reference: MeasuredBoqLibraryRateReference,
) => MeasuredBoqLibraryCatalogEntry | null;

export type MeasuredBoqEngineDependencies = {
  resolveLibraryRate: MeasuredBoqLibraryRateResolver;
};

// ── Rate sources ───────────────────────────────────────────────────────────

export type MeasuredBoqRateSource =
  | "library"
  | "user-quote"
  | "ai-assisted"
  | "fallback"
  | "unclassified";

/** Caller-facing library reference — identity only; no money fields. */
export type MeasuredBoqLibraryRate = {
  source: "library";
  rateKey: string;
  catalogRevision: string;
};

export type MeasuredBoqUserQuoteRate = {
  source: "user-quote";
  netUnitRate: number;
  currency: "GBP";
  vatBasis: "exclusive";
  quote: {
    supplierName: string;
    quoteReference: string;
    issuedAt: string;
    evidenceRef: string;
    acceptedByUserId: string;
    acceptedAt: string;
  };
};

export type MeasuredBoqDraftRate = {
  source: "ai-assisted" | "fallback" | "unclassified";
  candidateUnitRate: number;
  reason?: string;
};

export type MeasuredBoqRateInput =
  | MeasuredBoqLibraryRate
  | MeasuredBoqUserQuoteRate
  | MeasuredBoqDraftRate;

// ── Input contract (no money totals) ───────────────────────────────────────

export type MeasuredBoqCostType = "labour" | "materials" | "combined";

const VALID_COST_TYPES = new Set<MeasuredBoqCostType>(["labour", "materials", "combined"]);

export type MeasuredBoqLineInput = {
  id: string;
  name: string;
  category?: string;
  quantity: number;
  unit: string;
  costType?: MeasuredBoqCostType;
  rate: MeasuredBoqRateInput;
  notes?: string;
};

export type MeasuredBoqRoomInput = {
  id: string;
  name: string;
  areaSqm?: number;
  items: MeasuredBoqLineInput[];
};

/**
 * Engine input — BOQ structure only.
 * Must not carry a library resolver, catalogue, or money totals.
 */
export type MeasuredBoqEngineInput = {
  region: UKRegion;
  rooms: MeasuredBoqRoomInput[];
};

// ── Issues ─────────────────────────────────────────────────────────────────

export type MeasuredBoqIssueCode =
  | "NO_ROOMS"
  | "EMPTY_ROOM"
  | "MISSING_ROOM_ID"
  | "DUPLICATE_ROOM_ID"
  | "MISSING_ROOM_NAME"
  | "MISSING_LINE_ID"
  | "DUPLICATE_LINE_ID"
  | "INVALID_ITEM_NAME"
  | "INVALID_ITEM_UNIT"
  | "INVALID_ROOM_AREA"
  | "INVALID_QUANTITY"
  | "INVALID_COST_TYPE"
  | "INVALID_RATE"
  | "MISSING_LIBRARY_REFERENCE"
  | "MISSING_QUOTE_EVIDENCE"
  | "INVALID_QUOTE_DATE"
  | "INELIGIBLE_AI_RATE"
  | "INELIGIBLE_FALLBACK_RATE"
  | "UNCLASSIFIED_RATE"
  | "CATALOG_UNIT_MISMATCH"
  | "CATALOG_COST_TYPE_MISMATCH";

export type MeasuredBoqIssue = {
  code: MeasuredBoqIssueCode;
  path: string;
  message: string;
};

// ── Rate resolution ────────────────────────────────────────────────────────

/** Discrete library provenance — never parse rateReference for identity. */
export type MeasuredBoqLibraryLineProvenance = {
  rateKey: string;
  catalogRevision: string;
  unit: string;
  costType: MeasuredBoqCostType;
  baseUnitRate: number;
  regionalMultiplier: number;
  resolvedUnitRate: number;
};

export type EligibleMeasuredBoqRateResolution = {
  eligible: true;
  source: "library" | "user-quote";
  baseUnitRate: number;
  regionalMultiplier: number;
  resolvedUnitRate: number;
  reference: string;
  /** Present only for resolved library lines. */
  libraryProvenance?: MeasuredBoqLibraryLineProvenance;
  /** Trusted cost type from catalogue (library) or undefined (user-quote). */
  catalogCostType?: MeasuredBoqCostType;
};

export type IneligibleMeasuredBoqRateResolution = {
  eligible: false;
  source: "ai-assisted" | "fallback" | "unclassified" | "library" | "user-quote";
  issues: MeasuredBoqIssue[];
};

export type MeasuredBoqRateResolution =
  | EligibleMeasuredBoqRateResolution
  | IneligibleMeasuredBoqRateResolution;

/** Strict calendar date: YYYY-MM-DD only, real calendar components. */
export function isValidIsoDateOnly(value: string): boolean {
  if (typeof value !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

/**
 * Strict ISO date-time with seconds and explicit timezone (Z or ±HH:MM).
 * Rejects date-only and local times without offset.
 */
export function isValidIsoDateTime(value: string): boolean {
  if (typeof value !== "string") return false;
  const m =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;
  // Calendar validity of the date portion
  if (!isValidIsoDateOnly(`${m[1]}-${m[2]}-${m[3]}`)) return false;
  if (m[7] !== "Z") {
    const off = /^([+-])(\d{2}):(\d{2})$/.exec(m[7]!);
    if (!off) return false;
    const oh = Number(off[2]);
    const om = Number(off[3]);
    if (oh > 23 || om > 59) return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function isPositiveFinite(n: number): boolean {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function issue(code: MeasuredBoqIssueCode, path: string, message: string): MeasuredBoqIssue {
  return { code, path, message };
}

export type MeasuredBoqLineRateContext = {
  unit: string;
  costType?: MeasuredBoqCostType;
};

/**
 * Resolve a single rate to an eligible authority rate or structured issues.
 * Authority is derived here — callers cannot pass an authoritative flag or
 * library money amounts.
 *
 * Optional `lineContext` enables unit/cost-type compatibility checks for library
 * rates against the trusted catalogue entry.
 */
export function resolveMeasuredBoqRate(
  rate: MeasuredBoqRateInput,
  region: UKRegion,
  path: string,
  dependencies: MeasuredBoqEngineDependencies,
  lineContext?: MeasuredBoqLineRateContext,
): MeasuredBoqRateResolution {
  if (rate.source === "ai-assisted") {
    return {
      eligible: false,
      source: "ai-assisted",
      issues: [
        issue("INELIGIBLE_AI_RATE", path, "AI-assisted candidate rates are not authority-priced"),
      ],
    };
  }

  if (rate.source === "fallback") {
    return {
      eligible: false,
      source: "fallback",
      issues: [issue("INELIGIBLE_FALLBACK_RATE", path, "Fallback rates are not authority-priced")],
    };
  }

  if (rate.source === "unclassified") {
    return {
      eligible: false,
      source: "unclassified",
      issues: [
        issue("UNCLASSIFIED_RATE", path, "Unclassified free-typed rates are not authority-priced"),
      ],
    };
  }

  if (rate.source === "library") {
    const issues: MeasuredBoqIssue[] = [];
    if (typeof rate.rateKey !== "string" || rate.rateKey.trim() === "") {
      issues.push(
        issue("MISSING_LIBRARY_REFERENCE", path, "Library rate requires a non-empty rateKey"),
      );
    }
    if (typeof rate.catalogRevision !== "string" || rate.catalogRevision.trim() === "") {
      issues.push(
        issue(
          "MISSING_LIBRARY_REFERENCE",
          path,
          "Library rate requires a non-empty catalogRevision",
        ),
      );
    }
    if (issues.length > 0) {
      return { eligible: false, source: "library", issues };
    }

    const entry = dependencies.resolveLibraryRate({
      rateKey: rate.rateKey,
      catalogRevision: rate.catalogRevision,
    });

    if (!entry) {
      return {
        eligible: false,
        source: "library",
        issues: [
          issue(
            "MISSING_LIBRARY_REFERENCE",
            path,
            `No trusted library rate for ${rate.rateKey}@${rate.catalogRevision}`,
          ),
        ],
      };
    }

    // Entry must exactly match the requested identity (non-empty is not enough).
    if (entry.rateKey !== rate.rateKey || entry.catalogRevision !== rate.catalogRevision) {
      return {
        eligible: false,
        source: "library",
        issues: [
          issue(
            "MISSING_LIBRARY_REFERENCE",
            path,
            "Catalogue entry identity does not match requested library reference",
          ),
        ],
      };
    }

    if (!isPositiveFinite(entry.baseUnitRate)) {
      issues.push(
        issue(
          "INVALID_RATE",
          path,
          "Catalogue baseUnitRate must be a finite number greater than zero",
        ),
      );
    }
    if (entry.currency !== "GBP") {
      issues.push(issue("INVALID_RATE", path, "Catalogue currency must be GBP"));
    }
    if (entry.vatBasis !== "exclusive") {
      issues.push(issue("INVALID_RATE", path, "Catalogue rate must be VAT-exclusive"));
    }
    if (typeof entry.unit !== "string" || entry.unit.trim() === "") {
      issues.push(issue("INVALID_RATE", path, "Catalogue entry unit is required"));
    }
    if (
      typeof entry.costType !== "string" ||
      !VALID_COST_TYPES.has(entry.costType as MeasuredBoqCostType)
    ) {
      issues.push(
        issue(
          "INVALID_RATE",
          path,
          "Catalogue entry costType must be labour, materials, or combined",
        ),
      );
    }

    if (lineContext) {
      if (typeof lineContext.unit === "string" && lineContext.unit !== entry.unit) {
        issues.push(
          issue(
            "CATALOG_UNIT_MISMATCH",
            path,
            `Line unit "${lineContext.unit}" does not match catalogue unit "${entry.unit}"`,
          ),
        );
      }
      if (lineContext.costType !== undefined && lineContext.costType !== entry.costType) {
        issues.push(
          issue(
            "CATALOG_COST_TYPE_MISMATCH",
            path,
            `Line costType "${lineContext.costType}" does not match catalogue costType "${entry.costType}"`,
          ),
        );
      }
    }

    if (issues.length > 0) {
      return { eligible: false, source: "library", issues };
    }

    const regionalMultiplier = getRegionalMultiplier(region);
    const resolvedUnitRate = roundMeasuredBoqMoney(entry.baseUnitRate * regionalMultiplier);
    const libraryProvenance: MeasuredBoqLibraryLineProvenance = {
      rateKey: entry.rateKey,
      catalogRevision: entry.catalogRevision,
      unit: entry.unit,
      costType: entry.costType,
      baseUnitRate: entry.baseUnitRate,
      regionalMultiplier,
      resolvedUnitRate,
    };
    return {
      eligible: true,
      source: "library",
      baseUnitRate: entry.baseUnitRate,
      regionalMultiplier,
      resolvedUnitRate,
      reference: `${rate.rateKey}@${rate.catalogRevision}`,
      libraryProvenance,
      catalogCostType: entry.costType,
    };
  }

  if (rate.source !== "user-quote") {
    return {
      eligible: false,
      source: "unclassified",
      issues: [issue("UNCLASSIFIED_RATE", path, "Unknown rate source")],
    };
  }

  // user-quote (narrowed)
  const issues: MeasuredBoqIssue[] = [];
  const q = rate.quote;
  if (rate.currency !== "GBP") {
    issues.push(issue("INVALID_RATE", path, "User quote currency must be GBP"));
  }
  if (rate.vatBasis !== "exclusive") {
    issues.push(issue("INVALID_RATE", path, "User quote must be VAT-exclusive"));
  }
  if (!isPositiveFinite(rate.netUnitRate)) {
    issues.push(
      issue(
        "INVALID_RATE",
        path,
        "User quote netUnitRate must be a finite number greater than zero",
      ),
    );
  }

  const quoteBase = `${path}.quote`;
  if (!q || typeof q.supplierName !== "string" || q.supplierName.trim() === "") {
    issues.push(
      issue(
        "MISSING_QUOTE_EVIDENCE",
        `${quoteBase}.supplierName`,
        "User quote requires supplierName",
      ),
    );
  }
  if (!q || typeof q.quoteReference !== "string" || q.quoteReference.trim() === "") {
    issues.push(
      issue(
        "MISSING_QUOTE_EVIDENCE",
        `${quoteBase}.quoteReference`,
        "User quote requires quoteReference",
      ),
    );
  }
  if (!q || typeof q.evidenceRef !== "string" || q.evidenceRef.trim() === "") {
    issues.push(
      issue(
        "MISSING_QUOTE_EVIDENCE",
        `${quoteBase}.evidenceRef`,
        "User quote requires evidenceRef",
      ),
    );
  }
  if (!q || typeof q.acceptedByUserId !== "string" || q.acceptedByUserId.trim() === "") {
    issues.push(
      issue(
        "MISSING_QUOTE_EVIDENCE",
        `${quoteBase}.acceptedByUserId`,
        "User quote requires acceptedByUserId",
      ),
    );
  }
  if (!q || !isValidIsoDateOnly(q.issuedAt)) {
    issues.push(
      issue(
        "INVALID_QUOTE_DATE",
        `${quoteBase}.issuedAt`,
        "User quote issuedAt must be a valid ISO date (YYYY-MM-DD)",
      ),
    );
  }
  if (!q || !isValidIsoDateTime(q.acceptedAt)) {
    issues.push(
      issue(
        "INVALID_QUOTE_DATE",
        `${quoteBase}.acceptedAt`,
        "User quote acceptedAt must be a valid ISO date-time with timezone",
      ),
    );
  }
  if (issues.length > 0) {
    return { eligible: false, source: "user-quote", issues };
  }
  return {
    eligible: true,
    source: "user-quote",
    baseUnitRate: rate.netUnitRate,
    regionalMultiplier: 1,
    resolvedUnitRate: roundMeasuredBoqMoney(rate.netUnitRate),
    reference: q.quoteReference,
  };
}

// ── Result types ───────────────────────────────────────────────────────────

export type MeasuredBoqLineResult = {
  id: string;
  name: string;
  category?: string;
  quantity: number;
  unit: string;
  costType: MeasuredBoqCostType;
  rateSource: "library" | "user-quote";
  rateReference: string;
  baseUnitRate: number;
  regionalMultiplier: number;
  unitRate: number;
  totalCost: number;
  notes?: string;
  /** Discrete library provenance for persistence; absent for user-quote. */
  libraryProvenance?: MeasuredBoqLibraryLineProvenance;
};

export type MeasuredBoqRoomResult = {
  id: string;
  name: string;
  areaSqm?: number;
  items: MeasuredBoqLineResult[];
  subtotal: number;
};

export type MeasuredBoqPricingResult = {
  policyVersion: typeof MEASURED_BOQ_POLICY_VERSION;
  region: UKRegion;
  rooms: MeasuredBoqRoomResult[];
  labourTotal: number;
  materialsTotal: number;
  combinedTotal: number;
  subtotal: number;
  contingency: number;
  vat: number;
  lowTotal: number;
  midTotal: number;
  highTotal: number;
  assumptions: string[];
  warnings: string[];
};

export type MeasuredBoqEngineOutcome =
  | {
      status: "authority-priced";
      pricing: MeasuredBoqPricingResult;
      issues: [];
    }
  | {
      status: "draft";
      pricing: null;
      issues: MeasuredBoqIssue[];
    };

// ── Assessment ─────────────────────────────────────────────────────────────

/**
 * Structural + rate eligibility assessment. Collects every issue in one pass
 * in deterministic room/item traversal order.
 */
export function assessMeasuredBoqAuthority(
  input: MeasuredBoqEngineInput,
  dependencies: MeasuredBoqEngineDependencies,
): {
  eligible: boolean;
  issues: MeasuredBoqIssue[];
} {
  const issues: MeasuredBoqIssue[] = [];
  const rooms = input.rooms ?? [];

  if (rooms.length === 0) {
    issues.push(issue("NO_ROOMS", "rooms", "At least one room is required"));
    return { eligible: false, issues };
  }

  const seenRoomIds = new Set<string>();
  const seenLineIds = new Set<string>();

  for (let ri = 0; ri < rooms.length; ri++) {
    const room = rooms[ri]!;
    const roomPath = `rooms[${ri}]`;

    if (typeof room.id !== "string" || room.id.trim() === "") {
      issues.push(issue("MISSING_ROOM_ID", `${roomPath}.id`, "Room id must be non-empty"));
    } else if (seenRoomIds.has(room.id)) {
      issues.push(issue("DUPLICATE_ROOM_ID", `${roomPath}.id`, `Duplicate room id: ${room.id}`));
    } else {
      seenRoomIds.add(room.id);
    }

    if (typeof room.name !== "string" || room.name.trim() === "") {
      issues.push(issue("MISSING_ROOM_NAME", `${roomPath}.name`, "Room name must be non-empty"));
    }

    if (room.areaSqm !== undefined && room.areaSqm !== null) {
      if (typeof room.areaSqm !== "number" || !Number.isFinite(room.areaSqm) || room.areaSqm <= 0) {
        issues.push(
          issue(
            "INVALID_ROOM_AREA",
            `${roomPath}.areaSqm`,
            "Room areaSqm must be a finite number greater than zero when supplied",
          ),
        );
      }
    }

    const items = room.items ?? [];
    if (items.length === 0) {
      issues.push(issue("EMPTY_ROOM", `${roomPath}.items`, "Room must include at least one item"));
      continue;
    }

    for (let ii = 0; ii < items.length; ii++) {
      const item = items[ii]!;
      const itemPath = `${roomPath}.items[${ii}]`;

      if (typeof item.id !== "string" || item.id.trim() === "") {
        issues.push(issue("MISSING_LINE_ID", `${itemPath}.id`, "Line id must be non-empty"));
      } else if (seenLineIds.has(item.id)) {
        issues.push(issue("DUPLICATE_LINE_ID", `${itemPath}.id`, `Duplicate line id: ${item.id}`));
      } else {
        seenLineIds.add(item.id);
      }

      if (typeof item.name !== "string" || item.name.trim() === "") {
        issues.push(issue("INVALID_ITEM_NAME", `${itemPath}.name`, "Item name must be non-empty"));
      }

      if (typeof item.unit !== "string" || item.unit.trim() === "") {
        issues.push(issue("INVALID_ITEM_UNIT", `${itemPath}.unit`, "Item unit must be non-empty"));
      }

      if (!isPositiveFinite(item.quantity)) {
        issues.push(
          issue(
            "INVALID_QUANTITY",
            `${itemPath}.quantity`,
            "Quantity must be a finite number greater than zero",
          ),
        );
      }

      if (item.costType !== undefined) {
        if (
          typeof item.costType !== "string" ||
          !VALID_COST_TYPES.has(item.costType as MeasuredBoqCostType)
        ) {
          issues.push(
            issue(
              "INVALID_COST_TYPE",
              `${itemPath}.costType`,
              "costType must be labour, materials, or combined when supplied",
            ),
          );
        }
      }

      const rateResolution = resolveMeasuredBoqRate(
        item.rate,
        input.region,
        `${itemPath}.rate`,
        dependencies,
        { unit: item.unit, costType: item.costType },
      );
      if (!rateResolution.eligible) {
        issues.push(...rateResolution.issues);
      }
    }
  }

  return { eligible: issues.length === 0, issues };
}

// ── Engine ─────────────────────────────────────────────────────────────────

function buildAssumptions(region: UKRegion, hasUserQuote: boolean): string[] {
  const assumptions = [
    `Region: ${region}`,
    "Library rates use canonical regional adjustment",
    "Contingency: 10%",
    "VAT: 20% applied after contingency",
    "Range: -15% / +15% around the mid total",
  ];
  if (hasUserQuote) {
    assumptions.splice(2, 0, "User quotes are treated as project-specific VAT-exclusive net rates");
  }
  return assumptions;
}

function buildWarnings(lines: MeasuredBoqLineResult[]): string[] {
  const warnings: string[] = [];
  if (lines.some((l) => l.costType === "combined")) {
    warnings.push("Combined cost types are not split into labour and materials");
  }
  const sources = new Set(lines.map((l) => l.rateSource));
  if (sources.has("library") && sources.has("user-quote")) {
    warnings.push("Mixed library and user-quote rate sources");
  }
  return warnings;
}

/**
 * Run the measured-BOQ engine.
 *
 * Expected validation and ineligible rates return status "draft" with no
 * monetary outputs. Does not throw for normal draft input.
 *
 * Library amounts are obtained only from `dependencies.resolveLibraryRate`.
 */
export function runMeasuredBoqEngine(
  input: MeasuredBoqEngineInput,
  dependencies: MeasuredBoqEngineDependencies,
): MeasuredBoqEngineOutcome {
  const assessment = assessMeasuredBoqAuthority(input, dependencies);
  if (!assessment.eligible) {
    return { status: "draft", pricing: null, issues: assessment.issues };
  }

  const rooms: MeasuredBoqRoomResult[] = [];
  const allLines: MeasuredBoqLineResult[] = [];
  let labourTotal = 0;
  let materialsTotal = 0;
  let combinedTotal = 0;
  let hasUserQuote = false;

  for (const room of input.rooms) {
    const items: MeasuredBoqLineResult[] = [];
    for (const item of room.items) {
      const resolved = resolveMeasuredBoqRate(item.rate, input.region, "rate", dependencies, {
        unit: item.unit,
        costType: item.costType,
      });
      if (!resolved.eligible) {
        return {
          status: "draft",
          pricing: null,
          issues: resolved.issues,
        };
      }
      if (resolved.source === "user-quote") hasUserQuote = true;

      // Library lines: trusted catalogue cost type when caller omits costType.
      // Non-library: preserve historical default of "combined".
      const costType: MeasuredBoqCostType =
        item.costType ??
        (resolved.source === "library" && resolved.catalogCostType
          ? resolved.catalogCostType
          : "combined");
      const unitRate = resolved.resolvedUnitRate;
      const totalCost = roundMeasuredBoqMoney(item.quantity * unitRate);

      const line: MeasuredBoqLineResult = {
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        costType,
        rateSource: resolved.source,
        rateReference: resolved.reference,
        baseUnitRate: resolved.baseUnitRate,
        regionalMultiplier: resolved.regionalMultiplier,
        unitRate,
        totalCost,
        notes: item.notes,
        libraryProvenance: resolved.libraryProvenance,
      };
      items.push(line);
      allLines.push(line);

      if (costType === "labour") labourTotal = roundMeasuredBoqMoney(labourTotal + totalCost);
      else if (costType === "materials")
        materialsTotal = roundMeasuredBoqMoney(materialsTotal + totalCost);
      else combinedTotal = roundMeasuredBoqMoney(combinedTotal + totalCost);
    }

    const roomSubtotal = roundMeasuredBoqMoney(items.reduce((s, l) => s + l.totalCost, 0));
    rooms.push({
      id: room.id,
      name: room.name,
      areaSqm: room.areaSqm,
      items,
      subtotal: roomSubtotal,
    });
  }

  const subtotal = roundMeasuredBoqMoney(labourTotal + materialsTotal + combinedTotal);
  const contingency = roundMeasuredBoqMoney(subtotal * MEASURED_BOQ_CONTINGENCY_RATE);
  const vat = roundMeasuredBoqMoney((subtotal + contingency) * MEASURED_BOQ_VAT_RATE);
  const midTotal = roundMeasuredBoqMoney(subtotal + contingency + vat);
  const lowTotal = roundMeasuredBoqMoney(midTotal * MEASURED_BOQ_LOW_FACTOR);
  const highTotal = roundMeasuredBoqMoney(midTotal * MEASURED_BOQ_HIGH_FACTOR);

  const pricing: MeasuredBoqPricingResult = {
    policyVersion: MEASURED_BOQ_POLICY_VERSION,
    region: input.region,
    rooms,
    labourTotal,
    materialsTotal,
    combinedTotal,
    subtotal,
    contingency,
    vat,
    lowTotal,
    midTotal,
    highTotal,
    assumptions: buildAssumptions(input.region, hasUserQuote),
    warnings: buildWarnings(allLines),
  };

  return { status: "authority-priced", pricing, issues: [] };
}
