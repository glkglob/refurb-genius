// Mock redesign concepts. Each style has a curated palette + suggestions.
// Swap with a real image-gen pipeline later by replacing `afterGradient` with
// generated image URLs and keeping the same RedesignConcept shape.

export const REDESIGN_STYLES = [
  "Modern",
  "Luxury",
  "Scandinavian",
  "Airbnb",
  "Rental Standard",
  "Contemporary",
] as const;
export type RedesignStyle = (typeof REDESIGN_STYLES)[number];

export type RedesignConcept = {
  style: RedesignStyle;
  tagline: string;
  palette: { name: string; hex: string }[];
  flooring: string;
  lighting: string;
  furniture: string;
  // CSS gradient used as a polished "AI render" placeholder.
  afterGradient: string;
  // Real AI-generated render URL (DALL-E 3). When present, rendered instead of afterGradient.
  afterImageUrl?: string;
  /** Phase 3: estimated cost uplift vs baseline (mid estimate). Optional for backward compat. */
  estimatedCostUplift?: { low: number; mid: number; high: number; note?: string };
};

export const REDESIGN_CONCEPTS: RedesignConcept[] = [
  {
    style: "Modern",
    tagline: "Clean lines, neutral base, sharp accents.",
    palette: [
      { name: "Soft White", hex: "#F5F5F2" },
      { name: "Warm Stone", hex: "#D8D2C7" },
      { name: "Graphite", hex: "#2E2E33" },
      { name: "Brass", hex: "#B08D57" },
    ],
    flooring: "Wide-plank engineered oak in a matte natural finish.",
    lighting: "Recessed downlights with a sculptural matte black pendant.",
    furniture: "Low-profile sofa, oak coffee table, brass-accent shelving.",
    afterGradient: "linear-gradient(135deg, #F5F5F2 0%, #E4DED2 45%, #B08D57 100%)",
    estimatedCostUplift: {
      low: 8500,
      mid: 12500,
      high: 17500,
      note: "Premium materials and finishes uplift vs baseline",
    },
  },
  {
    style: "Luxury",
    tagline: "Rich materials, deep tones, statement detail.",
    palette: [
      { name: "Ink", hex: "#1B2230" },
      { name: "Champagne", hex: "#C9A96E" },
      { name: "Marble", hex: "#EDE7DD" },
      { name: "Velvet Plum", hex: "#4B2E48" },
    ],
    flooring: "Large-format polished porcelain with veined marble effect.",
    lighting: "Crystal chandelier centrepiece with concealed cove lighting.",
    furniture: "Velvet upholstery, brushed brass detailing, marble-top tables.",
    afterGradient: "linear-gradient(135deg, #1B2230 0%, #4B2E48 55%, #C9A96E 100%)",
  },
  {
    style: "Scandinavian",
    tagline: "Light, airy, natural materials.",
    palette: [
      { name: "Snow", hex: "#FAFAF7" },
      { name: "Pale Oak", hex: "#E6D8C3" },
      { name: "Sage", hex: "#B7C4B0" },
      { name: "Charcoal", hex: "#3A3A3A" },
    ],
    flooring: "Whitewashed oak boards with soft wool rugs.",
    lighting: "Paper pendant shades and warm 2700K LED strips.",
    furniture: "Light oak dining set, linen sofa, woven storage.",
    afterGradient: "linear-gradient(135deg, #FAFAF7 0%, #E6D8C3 55%, #B7C4B0 100%)",
    estimatedCostUplift: { low: 2200, mid: 3800, high: 5200, note: "Light natural refresh" },
  },
  {
    style: "Airbnb",
    tagline: "Photo-ready, on-trend, broadly appealing.",
    palette: [
      { name: "Cream", hex: "#F2EBDD" },
      { name: "Terracotta", hex: "#C97B5A" },
      { name: "Olive", hex: "#7F8B5A" },
      { name: "Rattan", hex: "#C9A77B" },
    ],
    flooring: "LVT herringbone in light oak — durable and on-camera.",
    lighting: "Layered: dimmable pendants, table lamps, smart bulbs.",
    furniture: "Bouclé chairs, rattan accents, statement art wall.",
    afterGradient: "linear-gradient(135deg, #F2EBDD 0%, #C9A77B 50%, #C97B5A 100%)",
  },
  {
    style: "Rental Standard",
    tagline: "Hard-wearing, neutral, low maintenance.",
    palette: [
      { name: "Magnolia", hex: "#F2EFE6" },
      { name: "Mid Grey", hex: "#A6A6A1" },
      { name: "Slate", hex: "#5A6068" },
      { name: "Oak", hex: "#B8966E" },
    ],
    flooring: "Hard-wearing LVT throughout, grey carpet to bedrooms.",
    lighting: "Simple flush ceiling lights with LED bulbs.",
    furniture: "Grey fabric sofa, oak-effect units, neutral bedding.",
    afterGradient: "linear-gradient(135deg, #F2EFE6 0%, #A6A6A1 55%, #5A6068 100%)",
  },
  {
    style: "Contemporary",
    tagline: "Current trends, soft contrast, organic shapes.",
    palette: [
      { name: "Bone", hex: "#EFE9DD" },
      { name: "Clay", hex: "#B68A6E" },
      { name: "Forest", hex: "#3F5141" },
      { name: "Black", hex: "#161616" },
    ],
    flooring: "Micro-cement floors with underfloor heating.",
    lighting: "Linear LED profiles and curved alabaster wall sconces.",
    furniture: "Curved sofa, sculptural lounge chair, organic timber slab table.",
    afterGradient: "linear-gradient(135deg, #EFE9DD 0%, #B68A6E 50%, #3F5141 100%)",
  },
];
