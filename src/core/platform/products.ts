export type ProductKey =
  | "platform"
  | "refurb-genius"
  | "deal-copilot"
  | "refurb-iq"
  | "agent-tools";

export type ProductDefinition = {
  key: ProductKey;
  name: string;
  shortName: string;
  description: string;
  href: string;
  comingSoon?: boolean;
};

export const PRODUCT_DEFINITIONS: Record<ProductKey, ProductDefinition> = {
  platform: {
    key: "platform",
    name: "AI Property Intelligence Ecosystem",
    shortName: "Platform",
    description: "Shared operating layer for property intelligence products.",
    href: "/dashboard",
  },
  "refurb-genius": {
    key: "refurb-genius",
    name: "Refurb Genius",
    shortName: "Refurbs",
    description: "AI refurbishment estimator and investor report engine.",
    href: "/dashboard",
  },
  "deal-copilot": {
    key: "deal-copilot",
    name: "Deal Copilot",
    shortName: "Deals",
    description: "AI acquisition assistant for property investors.",
    href: "/deal-copilot",
  },
  "refurb-iq": {
    key: "refurb-iq",
    name: "Refurb IQ",
    shortName: "IQ",
    description: "Professional BOQ, cost planning, and specification layer.",
    href: "/refurb-iq",
    comingSoon: true,
  },
  "agent-tools": {
    key: "agent-tools",
    name: "Agent Tools",
    shortName: "Agents",
    description: "AI listing, pre-sale, and rental-readiness tools.",
    href: "/agent-tools",
    comingSoon: true,
  },
};

export function getProductDefinition(productKey: ProductKey): ProductDefinition {
  return PRODUCT_DEFINITIONS[productKey];
}

export const PRODUCT_LIST = Object.values(PRODUCT_DEFINITIONS);
