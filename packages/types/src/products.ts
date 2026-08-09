export const PRODUCT_IDS = [
  "refurb-genius",
  "deal-copilot",
  "refurb-iq",
  "trades-marketplace",
] as const;

export type ProductId = (typeof PRODUCT_IDS)[number];

export type ProductStatus = "live" | "foundation" | "planned";

export type ProductConfig = {
  id: ProductId;
  name: string;
  description: string;
  status: ProductStatus;
  basePath: string;
  isCorePlatform: boolean;
};

export const PRODUCTS: Record<ProductId, ProductConfig> = {
  "refurb-genius": {
    id: "refurb-genius",
    name: "Refurb Genius",
    description: "Main platform shell, dashboard, reports, and shared refurbishment intelligence.",
    status: "live",
    basePath: "/dashboard",
    isCorePlatform: true,
  },
  "deal-copilot": {
    id: "deal-copilot",
    name: "Deal Copilot",
    description: "Opportunity analysis, deal persistence, and future deal-to-project conversion.",
    status: "live",
    basePath: "/deal-copilot",
    isCorePlatform: false,
  },
  "refurb-iq": {
    id: "refurb-iq",
    name: "Refurb IQ",
    description: "BOQ, cost plans, specifications, and editable execution outputs.",
    status: "planned",
    basePath: "/refurb-iq",
    isCorePlatform: false,
  },
  "trades-marketplace": {
    id: "trades-marketplace",
    name: "Trades",
    // Customer-facing maturity is split: job board live (beta); verified provider
    // directory not live. Status remains "live" for existing registry consumers
    // (composite maturity is a T2 concern — do not invent a new enum here).
    description:
      "Trades job board (limited beta), job interests, and self-submitted trade profiles. Provider directory/verification not mature.",
    status: "live",
    basePath: "/trades",
    isCorePlatform: false,
  },
};

export function getProductConfig(productId: ProductId): ProductConfig {
  return PRODUCTS[productId];
}

export function isProductId(value: string): value is ProductId {
  return PRODUCT_IDS.includes(value as ProductId);
}

export function getLiveProducts(): ProductConfig[] {
  return PRODUCT_IDS.map((productId) => PRODUCTS[productId]).filter(
    (product) => product.status === "live",
  );
}
