import beforeImg from "@/assets/before.jpg";
import afterImg from "@/assets/after.jpg";
import heroImg from "@/assets/hero-after.jpg";

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
  confidence_score: number;
};

export type AnalysisPhotoSource = {
  id: string;
  url: string;
  name: string;
  size?: number;
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

function pickTemplate(i: number) {
  return TEMPLATES[i % TEMPLATES.length];
}

export function buildMockRoomAnalyses(photos?: AnalysisPhotoSource[]): RoomAnalysis[] {
  const sources: AnalysisPhotoSource[] =
    photos && photos.length > 0
      ? photos
      : FALLBACK_PHOTOS.map((p, i) => ({ id: `fallback-${i}`, url: p.url, name: p.name }));

  return sources.map((src, i) => {
    const template = pickTemplate(i);
    return {
      id: src.id,
      photo_url: src.url,
      photo_name: src.name,
      ...template,
    };
  });
}
