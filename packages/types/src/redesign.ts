// RedesignConcept — AI-generated style concept for a space.
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
  afterGradient: string;
  afterImageUrl?: string;
  estimatedCostUplift?: { low: number; mid: number; high: number; note?: string };
};
