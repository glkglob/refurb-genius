/**
 * Edge case scenarios for regression testing.
 */
import type { ParsedDealFormData } from "@/types/deal-copilot";

/**
 * Heavy refurbishment scenario.
 * High costs, significant uplift potential.
 */
export const heavyRefurbInput: ParsedDealFormData = {
  title: "Full renovation project, Birmingham",
  purchasePrice: 180000,
  refurbBudget: 120000,
  estimatedGdv: 380000,
  rentalIncome: 800, // £800/month
  holdingCosts: 12000,
  region: "West Midlands",
  propertyCondition: "Poor",
};

/**
 * High-yield rental scenario.
 * Strong rental market, lower purchase price.
 */
export const highYieldInput: ParsedDealFormData = {
  title: "Multi-unit rental, Manchester",
  purchasePrice: 250000,
  refurbBudget: 40000,
  estimatedGdv: 320000,
  rentalIncome: 2500, // £2,500/month
  holdingCosts: 6000,
  region: "North West England",
  propertyCondition: "Average",
};

/**
 * Negative profit scenario.
 * Deal breaks even or loses money. Should still analyze safely.
 */
export const negativeProfitInput: ParsedDealFormData = {
  title: "Break-even investment, London",
  purchasePrice: 420000,
  refurbBudget: 80000,
  estimatedGdv: 490000,
  rentalIncome: 1200, // £1,200/month
  holdingCosts: 15000,
  region: "London",
  propertyCondition: "Average",
};

/**
 * Incomplete deal (missing refurb budget).
 * Should fail validation gracefully.
 */
export const incompleteDealInput: Partial<ParsedDealFormData> = {
  title: "Incomplete analysis",
  purchasePrice: 300000,
  // refurbBudget missing
  estimatedGdv: 400000,
  rentalIncome: 1500,
  holdingCosts: 8000,
  region: "London",
  propertyCondition: "Average",
};

/**
 * Edge case: very small project
 */
export const smallProjectInput: ParsedDealFormData = {
  title: "Studio renovation, Leeds",
  purchasePrice: 85000,
  refurbBudget: 12000,
  estimatedGdv: 110000,
  rentalIncome: 650, // £650/month
  holdingCosts: 2000,
  region: "Yorkshire and the Humber",
  propertyCondition: "Average",
};

/**
 * Edge case: very large project
 */
export const largeProjectInput: ParsedDealFormData = {
  title: "Portfolio acquisition, London",
  purchasePrice: 2500000,
  refurbBudget: 500000,
  estimatedGdv: 3200000,
  rentalIncome: 8000, // £8,000/month
  holdingCosts: 60000,
  region: "London",
  propertyCondition: "Dated",
};

/**
 * Regions with extreme multipliers.
 * High: London (1.3x), Low: Northern Ireland (0.88x)
 */
export const londonPremiumInput: ParsedDealFormData = {
  title: "Prime London property",
  purchasePrice: 600000,
  refurbBudget: 100000,
  estimatedGdv: 800000,
  rentalIncome: 3000,
  holdingCosts: 20000,
  region: "London",
  propertyCondition: "Average",
};

export const northernIrelandInput: ParsedDealFormData = {
  title: "Belfast rental investment",
  purchasePrice: 150000,
  refurbBudget: 30000,
  estimatedGdv: 200000,
  rentalIncome: 900,
  holdingCosts: 4000,
  region: "Northern Ireland",
  propertyCondition: "Average",
};

/**
 * Extreme condition levels
 */
export const modernPropertyInput: ParsedDealFormData = {
  title: "Modern property, minimal works",
  purchasePrice: 400000,
  refurbBudget: 10000,
  estimatedGdv: 420000,
  rentalIncome: 1800,
  holdingCosts: 6000,
  region: "London",
  propertyCondition: "Modern",
};

export const fullRenovationInput: ParsedDealFormData = {
  title: "Complete gutting required",
  purchasePrice: 200000,
  refurbBudget: 180000,
  estimatedGdv: 450000,
  rentalIncome: 1200,
  holdingCosts: 10000,
  region: "North West England",
  propertyCondition: "Full Renovation Needed",
};
