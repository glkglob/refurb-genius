import type { PropertyType } from "./project";

export type DealExitStrategy = "flip" | "buy_to_let" | "brrr" | "airbnb" | "hmo" | "hold";

export type DealOpportunityStatus =
  | "sourced"
  | "underwriting"
  | "watchlist"
  | "offer"
  | "won"
  | "lost"
  | "rejected";

export type DealOpportunityInput = {
  title: string;
  listingUrl?: string;
  postcode?: string;
  propertyType?: PropertyType;
  bedrooms?: number;
  purchasePrice?: number;
  estimatedGdv?: number;
  expectedMonthlyRent?: number;
  refurbBudget?: number;
  targetExitStrategy?: DealExitStrategy;
};

export type DealOpportunity = DealOpportunityInput & {
  id: string;
  status: DealOpportunityStatus;
  createdAt: string;
  updatedAt: string;
};

export function createDealOpportunity(
  input: DealOpportunityInput,
  now = new Date(),
): DealOpportunity {
  const timestamp = now.toISOString();

  return {
    ...input,
    id: crypto.randomUUID(),
    status: "sourced",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function isDealReadyForUnderwriting(input: DealOpportunityInput) {
  return Boolean(
    input.title?.trim() && input.purchasePrice && input.estimatedGdv && input.refurbBudget,
  );
}
