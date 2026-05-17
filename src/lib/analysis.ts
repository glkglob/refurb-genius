// Mock AI analysis. Mirrors the shape an OpenAI Vision call would return so it
// can be swapped out without touching consumers.
import beforeImg from "@/assets/before.jpg";
import afterImg from "@/assets/after.jpg";
import heroImg from "@/assets/hero-after.jpg";
import { ProjectPhoto, photoStore } from "./photos";
import { auth } from "./auth";

export const ROOM_TYPES = [
  "Kitchen",
  "Bathroom",
  "Bedroom",
  "Living Room",
  "Hallway",
  "Exterior",
  "Garden",
  "Other",
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const CONDITION_LEVELS = [
  "Modern",
  "Average",
  "Dated",
  "Poor",
  "Full Renovation Needed",
] as const;
export type ConditionLevel = (typeof CONDITION_LEVELS)[number];

export const REFURB_LEVELS = ["Light", "Medium", "Heavy", "Full"] as const;
export type RefurbLevel = (typeof REFURB_LEVELS)[number];

export type RoomAnalysis = {
  id: string;
  photo_url: string;
  photo_name: string;
  room_type: RoomType;
  condition_level: ConditionLevel;
  refurbishment_level: RefurbLevel;
  visible_issues: string[];
  recommended_works: string[];
  ai_summary: string;
  confidence_score: number; // 0..1
};

const FALLBACK_PHOTOS = [
  { url: beforeImg, name: "fallback-living.jpg" },
  { url: afterImg, name: "fallback-kitchen.jpg" },
  { url: heroImg, name: "fallback-exterior.jpg" },
];

const TEMPLATES: Array<Omit<RoomAnalysis, "id" | "photo_url" | "photo_name">> = [
  {
    room_type: "Kitchen",
    condition_level: "Poor",
    refurbishment_level: "Heavy",
    visible_issues: [
      "Dated cabinetry with worn finishes",
      "Damaged worktop near sink",
      "Old single-oven appliance set",
      "Vinyl flooring lifting at edges",
    ],
    recommended_works: [
      "Full kitchen replacement with shaker units",
      "Quartz worktops and upstands",
      "New integrated appliance package",
      "LVT flooring with underlay",
    ],
    ai_summary:
      "Kitchen requires a full replacement to reach a modern saleable standard. Strong uplift opportunity with an open-plan reconfiguration if structurally feasible.",
    confidence_score: 0.92,
  },
  {
    room_type: "Bathroom",
    condition_level: "Dated",
    refurbishment_level: "Medium",
    visible_issues: [
      "Cracked tiling around bath",
      "Mould around sealant",
      "Outdated suite and taps",
    ],
    recommended_works: [
      "Strip out and full retile floor to ceiling",
      "New suite, vanity and thermostatic shower",
      "Upgrade extractor fan to humidity-sensing unit",
    ],
    ai_summary:
      "Mid-level bathroom refurb will modernise the space and resolve moisture issues. Specify neutral tiling for broadest buyer appeal.",
    confidence_score: 0.87,
  },
  {
    room_type: "Living Room",
    condition_level: "Average",
    refurbishment_level: "Light",
    visible_issues: ["Tired paintwork", "Worn carpet", "Dated pendant lighting"],
    recommended_works: [
      "Repaint walls and ceilings in neutral palette",
      "Sand and refinish original floorboards",
      "Replace lighting with modern fittings",
    ],
    ai_summary:
      "Cosmetic refresh only. High-impact changes for relatively low spend — prioritise flooring and lighting for staging photos.",
    confidence_score: 0.81,
  },
  {
    room_type: "Bedroom",
    condition_level: "Average",
    refurbishment_level: "Light",
    visible_issues: ["Marked walls", "Dated carpet", "Old radiator"],
    recommended_works: [
      "Full redecoration",
      "New carpet with quality underlay",
      "Replace radiator with modern panel unit",
    ],
    ai_summary:
      "Bedroom needs a light refresh to match a modernised property. No structural work required.",
    confidence_score: 0.84,
  },
  {
    room_type: "Hallway",
    condition_level: "Dated",
    refurbishment_level: "Light",
    visible_issues: ["Scuffed walls", "Old consumer unit visible", "Tired flooring"],
    recommended_works: [
      "Box in consumer unit",
      "Repaint with hard-wearing finish",
      "Install LVT flooring continuous with kitchen",
    ],
    ai_summary:
      "First impression space — a tidy, neutral hallway materially improves perceived value.",
    confidence_score: 0.78,
  },
  {
    room_type: "Exterior",
    condition_level: "Dated",
    refurbishment_level: "Medium",
    visible_issues: [
      "Pointing degraded in places",
      "Front door and frame weathered",
      "Garden overgrown",
    ],
    recommended_works: [
      "Localised repointing",
      "New composite front door",
      "Tidy and re-landscape front garden",
    ],
    ai_summary:
      "Kerb appeal can be lifted significantly with a new front door and tidy frontage. Confirm pointing scope on site.",
    confidence_score: 0.74,
  },
];

const cache = new Map<string, RoomAnalysis[]>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function pickTemplate(i: number) {
  return TEMPLATES[i % TEMPLATES.length];
}

function buildFromPhotos(projectId: string): RoomAnalysis[] {
  const photos = photoStore.list(projectId);
  const sources: { id: string; url: string; name: string }[] =
    photos.length > 0
      ? photos.map((p: ProjectPhoto) => ({ id: p.id, url: p.url, name: p.name }))
      : FALLBACK_PHOTOS.map((p, i) => ({ id: `fallback-${i}`, url: p.url, name: p.name }));

  return sources.map((src, i) => {
    const t = pickTemplate(i);
    return {
      id: src.id,
      photo_url: src.url,
      photo_name: src.name,
      ...t,
    };
  });
}

function delay(ms = 1200) {
  return new Promise((r) => setTimeout(r, ms));
}

export const analysisStore = {
  get(projectId: string): RoomAnalysis[] | undefined {
    return cache.get(projectId);
  },
  async run(projectId: string): Promise<RoomAnalysis[]> {
    if (import.meta.env.VITE_OPENAI_API_KEY) {
      // Delegate to real Vision provider. Dynamic import avoids circular module refs.
      const { openAiVisionPhotoAnalysisProvider } = await import("@/core/ai/openAiVisionProvider");
      const result = await openAiVisionPhotoAnalysisProvider.run({ projectId });
      cache.set(projectId, result);
      notify();
      return result;
    }
    await delay();
    const result = buildFromPhotos(projectId);
    cache.set(projectId, result);
    notify();
    return result;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// Clear cache on auth change to prevent stale analysis from previous user
if (typeof window !== "undefined") {
  auth.onChange(() => {
    cache.clear();
    notify();
  });
}
