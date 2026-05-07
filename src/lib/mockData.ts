export { UK_REGIONS, PROPERTY_TYPES, projectStore, estimatedRefurbCost, estimatedProfit } from "./projects";
export type { Project, PropertyType, UKRegion } from "./projects";

export const DISCLAIMER =
  "AI-generated refurbishment estimates and visualisations are for guidance only and are not fixed contractor quotations. Actual costs may vary depending on labour, materials, site conditions, and regional pricing.";


export const mockAnalysis = {
  rooms: [
    { name: "Kitchen", condition: "Poor", priority: "High", notes: "Dated units, worn flooring, replace appliances." },
    { name: "Living Room", condition: "Fair", priority: "Medium", notes: "Repaint, refinish flooring, modernise lighting." },
    { name: "Bathroom", condition: "Poor", priority: "High", notes: "Full retile, replace suite, improve ventilation." },
    { name: "Bedroom 1", condition: "Good", priority: "Low", notes: "Cosmetic refresh only." },
  ],
  recommendations: [
    "Open-plan kitchen/diner reconfiguration",
    "Full rewire and consumer unit upgrade",
    "Loft insulation top-up to current regs",
    "Replace single-glazed windows with double glazing",
  ],
};

export const mockEstimate = {
  total: 64500,
  breakdown: [
    { category: "Kitchen", cost: 14500 },
    { category: "Bathroom", cost: 9800 },
    { category: "Electrics", cost: 7200 },
    { category: "Plumbing", cost: 5400 },
    { category: "Decoration", cost: 6300 },
    { category: "Flooring", cost: 5800 },
    { category: "Windows", cost: 8200 },
    { category: "Contingency (10%)", cost: 7300 },
  ],
};

export const mockMetrics = {
  purchasePrice: 285000,
  refurbCost: 64500,
  gdv: 410000,
  roi: 18.4,
  yieldPct: 6.2,
  monthlyRent: 1850,
};

export type RecentAnalysis = {
  id: string;
  projectId: string;
  projectName: string;
  room: string;
  summary: string;
  when: string;
};

export const mockRecentAnalyses: RecentAnalysis[] = [
  { id: "a1", projectId: "1", projectName: "Victorian Terrace Refurb", room: "Kitchen", summary: "High priority — full kitchen replacement recommended.", when: "2h ago" },
  { id: "a2", projectId: "2", projectName: "Manchester Buy-to-Let", room: "Bathroom", summary: "Retile, replace suite, improve ventilation.", when: "Yesterday" },
  { id: "a3", projectId: "1", projectName: "Victorian Terrace Refurb", room: "Living Room", summary: "Cosmetic refresh — repaint and refinish flooring.", when: "Yesterday" },
  { id: "a4", projectId: "3", projectName: "Edinburgh Tenement Flat", room: "Bedroom 1", summary: "Good condition, low priority.", when: "3d ago" },
];
