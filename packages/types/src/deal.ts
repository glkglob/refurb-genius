import type { ProductId } from "./products";

export type DealId = string;

export type DealStatus = "draft" | "active" | "under-review" | "converted" | "archived";

export type DealSource = "manual" | "deal-copilot" | "imported";

export type DealAddress = {
  line1: string;
  line2?: string;
  townOrCity?: string;
  county?: string;
  postcode?: string;
  country?: string;
};

export type DealFinancials = {
  purchasePrice?: number;
  estimatedGdv?: number;
  estimatedRefurbCost?: number;
  estimatedFees?: number;
  estimatedProfit?: number;
  estimatedRoiPercent?: number;
};

export type DealMetadata = {
  productSource: Extract<ProductId, "deal-copilot">;
  createdAt?: string;
  updatedAt?: string;
  convertedProjectId?: string;
};

export type DealSummary = {
  id: DealId;
  title: string;
  status: DealStatus;
  source: DealSource;
  address?: DealAddress;
  financials?: DealFinancials;
  metadata: DealMetadata;
};

export type DealInput = {
  title: string;
  source?: DealSource;
  address?: DealAddress;
  financials?: DealFinancials;
};

export function createDealMetadata(
  values?: Partial<Omit<DealMetadata, "productSource">>,
): DealMetadata {
  return {
    productSource: "deal-copilot",
    ...values,
  };
}
