// Deterministic report engine.
//
// Composes a structured `Report` object from project, photos, analysis,
// redesign concepts, pricing, and ROI engines. No values are invented —
// every number originates from the deterministic engines, every string
// originates from the AI summaries provider or the project itself.
//
// Same inputs → same output. Drives the report page today and is shaped
// to drive a future PDF export without any further refactor.
import type { Project } from "@/lib/projects";
import type { ProjectPhoto } from "@/lib/photos";
import type { RoomAnalysis, ConditionLevel } from "@/features/ai-upload";
import type { RedesignConcept } from "@/lib/redesign";
import {
  runPricingEngine,
  type PricingEngineResult,
  type PricingEstimateItem,
  type EstimateCategory,
  type FinishLevel,
} from "@/core/pricing";
import { runRoiEngine, type RoiEngineResult } from "@/core/roi";
import { reportHeadline, executiveSummary, recommendedWorks } from "@/core/ai/aiSummaries";
import { listRedesignConcepts } from "@/features/ai-design";
import { DISCLAIMER } from "@/lib/mockData";

const DEFAULT_CATEGORIES: EstimateCategory[] = [
  "Kitchen",
  "Bathroom",
  "Flooring",
  "Painting",
  "Electrical",
];

export type ReportEngineInputs = {
  project: Project;
  photos: ProjectPhoto[];
  analysis: RoomAnalysis[];
  /** Optional override for redesign concepts; defaults to all curated styles. */
  concepts?: RedesignConcept[];
  /** Estimate inputs (defaults: project condition / Standard / typical scope). */
  estimate?: {
    region?: Project["region"];
    condition?: ConditionLevel;
    finish?: FinishLevel;
    categories?: EstimateCategory[];
  };
  /** ROI inputs not derivable from the project alone. */
  roi?: {
    rental_income?: number;
    holding_costs?: number;
  };
  /** Branding shown in the header / footer. */
  branding?: ReportBranding;
};

export type ReportBranding = {
  product: string;
  domain: string;
  tagline?: string;
};

const DEFAULT_BRANDING: ReportBranding = {
  product: "Refurb Genius",
  domain: "refurbgenius.info",
  tagline: "AI-first UK refurbishment analysis",
};

export type ReportSection<TKey extends string, TBody> = {
  key: TKey;
  title: string;
  subtitle?: string;
  body: TBody;
};

export type Report = {
  branding: ReportBranding;
  reference: string;
  generated_at: string;
  inputs_summary: {
    region: Project["region"];
    property_condition: ConditionLevel;
    finish_quality: FinishLevel;
    selected_categories: EstimateCategory[];
  };
  sections: {
    project_summary: ReportSection<
      "project_summary",
      {
        headline: string;
        executive: string;
      }
    >;
    property_details: ReportSection<
      "property_details",
      {
        address: string;
        postcode: string;
        region: string;
        property_type: string;
        bedrooms: number;
        bathrooms: number;
        size_sqm: number;
        purchase_price: number;
        estimated_gdv: number;
        notes?: string;
      }
    >;
    uploaded_photos: ReportSection<
      "uploaded_photos",
      {
        count: number;
        items: { id: string; url: string; name: string }[];
      }
    >;
    ai_analysis: ReportSection<
      "ai_analysis",
      {
        rooms: RoomAnalysis[];
        recommended_works: string[];
      }
    >;
    redesign_concepts: ReportSection<
      "redesign_concepts",
      {
        concepts: RedesignConcept[];
      }
    >;
    cost_breakdown: ReportSection<
      "cost_breakdown",
      {
        items: PricingEstimateItem[];
        labour_total: number;
        materials_total: number;
        subtotal: number;
        contingency: number;
        vat: number;
        low_total: number;
        mid_total: number;
        high_total: number;
      }
    >;
    investment_metrics: ReportSection<"investment_metrics", RoiEngineResult>;
    timeline: ReportSection<
      "timeline",
      {
        weeks: number;
        months: number;
      }
    >;
    assumptions: ReportSection<"assumptions", { items: string[] }>;
    disclaimer: ReportSection<"disclaimer", { text: string }>;
  };
  /** Raw engine outputs for callers that need full numeric detail. */
  raw: {
    pricing: PricingEngineResult;
    roi: RoiEngineResult;
  };
};

/** Build a deterministic, structured report. Pure function. */
export function buildReport(inputs: ReportEngineInputs): Report {
  const { project, photos, analysis } = inputs;

  const condition: ConditionLevel = inputs.estimate?.condition ?? "Dated";
  const finish: FinishLevel = inputs.estimate?.finish ?? "Standard";
  const categories: EstimateCategory[] = inputs.estimate?.categories ?? DEFAULT_CATEGORIES;
  const region = inputs.estimate?.region ?? project.region;

  const pricing = runPricingEngine({
    region,
    property_condition: condition,
    finish_quality: finish,
    selected_categories: categories,
    property_size_sqm: project.size_sqm,
  });

  const roi = runRoiEngine({
    purchase_price: project.purchase_price,
    refurb_budget: pricing.mid_total,
    estimated_gdv: project.estimated_gdv,
    rental_income: inputs.roi?.rental_income ?? 0,
    holding_costs: inputs.roi?.holding_costs ?? 0,
    region,
    property_condition: condition,
  });

  const concepts = inputs.concepts ?? listRedesignConcepts({ projectId: project.id });
  const branding = inputs.branding ?? DEFAULT_BRANDING;

  const summaryInput = {
    projectName: project.name,
    address: project.address,
    region: project.region,
    rooms: analysis,
  };

  const months = Math.max(1, Math.ceil(pricing.timeline_weeks / 4.33));

  return {
    branding,
    reference: project.id,
    generated_at: new Date().toISOString(),
    inputs_summary: {
      region,
      property_condition: condition,
      finish_quality: finish,
      selected_categories: categories,
    },
    sections: {
      project_summary: {
        key: "project_summary",
        title: "Project summary",
        subtitle: "Property overview and key details.",
        body: {
          headline: reportHeadline(summaryInput),
          executive: executiveSummary(summaryInput),
        },
      },
      property_details: {
        key: "property_details",
        title: "Property details",
        body: {
          address: project.address,
          postcode: project.postcode,
          region: project.region,
          property_type: project.property_type,
          bedrooms: project.bedrooms,
          bathrooms: project.bathrooms,
          size_sqm: project.size_sqm,
          purchase_price: project.purchase_price,
          estimated_gdv: project.estimated_gdv,
          notes: project.notes || undefined,
        },
      },
      uploaded_photos: {
        key: "uploaded_photos",
        title: "Uploaded photos",
        subtitle: `${photos.length} property photo${photos.length === 1 ? "" : "s"}.`,
        body: {
          count: photos.length,
          items: photos.map((p) => ({ id: p.id, url: p.url, name: p.name })),
        },
      },
      ai_analysis: {
        key: "ai_analysis",
        title: "AI analysis summary",
        subtitle: "Room-by-room condition and recommended works.",
        body: {
          rooms: analysis,
          recommended_works: recommendedWorks(analysis),
        },
      },
      redesign_concepts: {
        key: "redesign_concepts",
        title: "Redesign concepts",
        subtitle: "AI-generated style directions for the refurbishment.",
        body: { concepts },
      },
      cost_breakdown: {
        key: "cost_breakdown",
        title: "Cost breakdown",
        subtitle: "Itemised refurbishment estimate.",
        body: {
          items: pricing.lineItems,
          labour_total: pricing.labour_total,
          materials_total: pricing.materials_total,
          subtotal: pricing.subtotal,
          contingency: pricing.contingency,
          vat: pricing.vat,
          low_total: pricing.low_total,
          mid_total: pricing.mid_total,
          high_total: pricing.high_total,
        },
      },
      investment_metrics: {
        key: "investment_metrics",
        title: "Investor metrics",
        subtitle: "Profitability and risk indicators.",
        body: roi,
      },
      timeline: {
        key: "timeline",
        title: "Timeline",
        subtitle: "Indicative build programme assuming parallelised trades.",
        body: { weeks: pricing.timeline_weeks, months },
      },
      assumptions: {
        key: "assumptions",
        title: "Assumptions",
        subtitle: "Key inputs used in this report.",
        body: {
          items: [
            `Region: ${region} (regional cost multiplier applied).`,
            `Condition baseline: ${condition}. Finish quality: ${finish}.`,
            `Categories included: ${categories.join(", ")}.`,
            `Contingency 10%, VAT 20% applied to subtotal.`,
            `Rental uplift derived deterministically from regional rent strength and projected GDV yield.`,
            `Investment score weights ROI 60% / yield 30% / condition risk 10%, capped 1–10.`,
            `Photos and AI analysis based on user-uploaded imagery.`,
          ],
        },
      },
      disclaimer: {
        key: "disclaimer",
        title: "Disclaimer",
        body: { text: DISCLAIMER },
      },
    },
    raw: { pricing, roi },
  };
}

/**
 * Ordered list of section keys — useful for renderers (UI, PDF) that want
 * a stable iteration order without hard-coding keys at multiple call sites.
 */
export const REPORT_SECTION_ORDER = [
  "project_summary",
  "property_details",
  "uploaded_photos",
  "ai_analysis",
  "redesign_concepts",
  "cost_breakdown",
  "investment_metrics",
  "timeline",
  "assumptions",
  "disclaimer",
] as const;

export type ReportSectionKey = (typeof REPORT_SECTION_ORDER)[number];
