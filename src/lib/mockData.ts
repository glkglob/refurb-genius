export const UK_REGIONS = [
  "London",
  "South East England",
  "South West England",
  "East of England",
  "East Midlands",
  "West Midlands",
  "North West England",
  "North East England",
  "Yorkshire and the Humber",
  "Scotland",
  "Wales",
  "Northern Ireland",
];

export const DISCLAIMER =
  "AI-generated refurbishment estimates and visualisations are for guidance only and are not fixed contractor quotations. Actual costs may vary depending on labour, materials, site conditions, and regional pricing.";

export type Project = {
  id: string;
  name: string;
  address: string;
  region: string;
  propertyType: string;
  status: "Draft" | "Analysing" | "Estimated" | "Complete";
  createdAt: string;
  beds: number;
  estimate: number;
  uplift: number;
};

export const mockProjects: Project[] = [
  {
    id: "1",
    name: "Victorian Terrace Refurb",
    address: "12 Elm Street, London",
    region: "London",
    propertyType: "Terraced House",
    status: "Estimated",
    createdAt: "2026-04-12",
    beds: 3,
    estimate: 64500,
    uplift: 95000,
  },
  {
    id: "2",
    name: "Manchester Buy-to-Let",
    address: "44 Oak Road, Manchester",
    region: "North West England",
    propertyType: "Semi-Detached",
    status: "Analysing",
    createdAt: "2026-04-28",
    beds: 2,
    estimate: 38000,
    uplift: 52000,
  },
  {
    id: "3",
    name: "Edinburgh Tenement Flat",
    address: "8 Royal Mile, Edinburgh",
    region: "Scotland",
    propertyType: "Flat",
    status: "Complete",
    createdAt: "2026-03-04",
    beds: 1,
    estimate: 22500,
    uplift: 34000,
  },
];

export function getProject(id: string): Project | undefined {
  return mockProjects.find((p) => p.id === id);
}

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
