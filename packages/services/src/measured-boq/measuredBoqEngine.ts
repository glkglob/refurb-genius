/**
 * Deterministic measured-BOQ financial engine (L3 room/line authority).
 *
 * Separate from category-based runPricingEngine. Does not convert BOQ lines
 * into broad refurbishment categories. Presentation must not recompute these
 * totals for authority-priced results.
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

// ── Rate sources ───────────────────────────────────────────────────────────

export type MeasuredBoqRateSource =
  | "library"
  | "user-quote"
  | "ai-assisted"
  | "fallback"
  | "unclassified";

export type MeasuredBoqLibraryRate = {
  source: "library";
  rateKey: string;
  catalogRevision: string;
  baseUnitRate: number;
  currency: "GBP";
  vatBasis: "exclusive";
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

export type MeasuredBoqEngineInput = {
  region: UKRegion;
  rooms: MeasuredBoqRoomInput[];
};

// ── Issues ─────────────────────────────────────────────────────────────────

export type MeasuredBoqIssueCode =
  | "NO_ROOMS"
  | "EMPTY_ROOM"
  | "DUPLICATE_ROOM_ID"
  | "DUPLICATE_LINE_ID"
  | "INVALID_ROOM_AREA"
  | "INVALID_QUANTITY"
  | "INVALID_RATE"
  | "MISSING_LIBRARY_REFERENCE"
  | "MISSING_QUOTE_EVIDENCE"
  | "INVALID_QUOTE_DATE"
  | "INELIGIBLE_AI_RATE"
  | "INELIGIBLE_FALLBACK_RATE"
  | "UNCLASSIFIED_RATE";

export type MeasuredBoqIssue = {
  code: MeasuredBoqIssueCode;
  path: string;
  message: string;
};

// ── Rate resolution ────────────────────────────────────────────────────────

export type EligibleMeasuredBoqRateResolution = {
  eligible: true;
  source: "library" | "user-quote";
  baseUnitRate: number;
  regionalMultiplier: number;
  resolvedUnitRate: number;
  reference: string;
};

export type IneligibleMeasuredBoqRateResolution = {
  eligible: false;
  source: "ai-assisted" | "fallback" | "unclassified" | "library" | "user-quote";
  issues: MeasuredBoqIssue[];
};

export type MeasuredBoqRateResolution =
  | EligibleMeasuredBoqRateResolution
  | IneligibleMeasuredBoqRateResolution;

function isValidIsoDate(value: string): boolean {
  if (typeof value !== "string" || value.trim() === "") return false;
  // Accept date (YYYY-MM-DD) or full ISO date-time.
  const t = Date.parse(value);
  return Number.isFinite(t);
}

function isPositiveFinite(n: number): boolean {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function issue(code: MeasuredBoqIssueCode, path: string, message: string): MeasuredBoqIssue {
  return { code, path, message };
}

/**
 * Resolve a single rate to an eligible authority rate or structured issues.
 * Authority is derived here — callers cannot pass an authoritative flag.
 */
export function resolveMeasuredBoqRate(
  rate: MeasuredBoqRateInput,
  region: UKRegion,
  path: string,
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
    if (rate.currency !== "GBP") {
      issues.push(issue("INVALID_RATE", path, "Library rate currency must be GBP"));
    }
    if (rate.vatBasis !== "exclusive") {
      issues.push(issue("INVALID_RATE", path, "Library rate must be VAT-exclusive"));
    }
    if (!isPositiveFinite(rate.baseUnitRate)) {
      issues.push(
        issue(
          "INVALID_RATE",
          path,
          "Library baseUnitRate must be a finite number greater than zero",
        ),
      );
    }
    if (issues.length > 0) {
      return { eligible: false, source: "library", issues };
    }
    const regionalMultiplier = getRegionalMultiplier(region);
    const resolvedUnitRate = roundMeasuredBoqMoney(rate.baseUnitRate * regionalMultiplier);
    return {
      eligible: true,
      source: "library",
      baseUnitRate: rate.baseUnitRate,
      regionalMultiplier,
      resolvedUnitRate,
      reference: `${rate.rateKey}@${rate.catalogRevision}`,
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
  if (!q || typeof q.supplierName !== "string" || q.supplierName.trim() === "") {
    issues.push(issue("MISSING_QUOTE_EVIDENCE", path, "User quote requires supplierName"));
  }
  if (!q || typeof q.quoteReference !== "string" || q.quoteReference.trim() === "") {
    issues.push(issue("MISSING_QUOTE_EVIDENCE", path, "User quote requires quoteReference"));
  }
  if (!q || typeof q.evidenceRef !== "string" || q.evidenceRef.trim() === "") {
    issues.push(issue("MISSING_QUOTE_EVIDENCE", path, "User quote requires evidenceRef"));
  }
  if (!q || typeof q.acceptedByUserId !== "string" || q.acceptedByUserId.trim() === "") {
    issues.push(issue("MISSING_QUOTE_EVIDENCE", path, "User quote requires acceptedByUserId"));
  }
  if (!q || !isValidIsoDate(q.issuedAt)) {
    issues.push(issue("INVALID_QUOTE_DATE", path, "User quote issuedAt must be a valid ISO date"));
  }
  if (!q || !isValidIsoDate(q.acceptedAt)) {
    issues.push(
      issue("INVALID_QUOTE_DATE", path, "User quote acceptedAt must be a valid ISO date-time"),
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
export function assessMeasuredBoqAuthority(input: MeasuredBoqEngineInput): {
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
      issues.push(issue("DUPLICATE_ROOM_ID", `${roomPath}.id`, "Room id must be non-empty"));
    } else if (seenRoomIds.has(room.id)) {
      issues.push(issue("DUPLICATE_ROOM_ID", `${roomPath}.id`, `Duplicate room id: ${room.id}`));
    } else {
      seenRoomIds.add(room.id);
    }

    if (typeof room.name !== "string" || room.name.trim() === "") {
      issues.push(issue("EMPTY_ROOM", `${roomPath}.name`, "Room name must be non-empty"));
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
        issues.push(issue("DUPLICATE_LINE_ID", `${itemPath}.id`, "Line id must be non-empty"));
      } else if (seenLineIds.has(item.id)) {
        issues.push(issue("DUPLICATE_LINE_ID", `${itemPath}.id`, `Duplicate line id: ${item.id}`));
      } else {
        seenLineIds.add(item.id);
      }

      if (typeof item.name !== "string" || item.name.trim() === "") {
        issues.push(issue("INVALID_QUANTITY", `${itemPath}.name`, "Item name must be non-empty"));
      }

      if (typeof item.unit !== "string" || item.unit.trim() === "") {
        issues.push(issue("INVALID_QUANTITY", `${itemPath}.unit`, "Item unit must be non-empty"));
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

      const rateResolution = resolveMeasuredBoqRate(item.rate, input.region, `${itemPath}.rate`);
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
 */
export function runMeasuredBoqEngine(input: MeasuredBoqEngineInput): MeasuredBoqEngineOutcome {
  const assessment = assessMeasuredBoqAuthority(input);
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
      const resolved = resolveMeasuredBoqRate(item.rate, input.region, "rate");
      // Assessment already ensured eligible; this is a type guard.
      if (!resolved.eligible) {
        return {
          status: "draft",
          pricing: null,
          issues: resolved.issues,
        };
      }
      if (resolved.source === "user-quote") hasUserQuote = true;

      const costType: MeasuredBoqCostType = item.costType ?? "combined";
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
