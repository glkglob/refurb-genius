import type { ProductId } from "../platform/products";
import type { RiskItem } from "./risk";

export type ScenarioId = string;

export type ScenarioType = "base" | "optimistic" | "pessimistic" | "custom";

export type ScenarioSourceProductId = Extract<ProductId, "deal-copilot" | "refurb-iq">;

export type ScenarioFinancials = {
  purchasePrice?: number;
  gdv?: number;
  refurbCost?: number;
  fees?: number;
  contingency?: number;
  profit?: number;
  roiPercent?: number;
};

export type ScenarioProgramme = {
  acquisitionWeeks?: number;
  refurbWeeks?: number;
  salesWeeks?: number;
  totalWeeks?: number;
};

export type Scenario = {
  id: ScenarioId;
  title: string;
  type: ScenarioType;
  sourceProductId: ScenarioSourceProductId;
  financials?: ScenarioFinancials;
  programme?: ScenarioProgramme;
  risks?: RiskItem[];
  createdAt?: string;
  updatedAt?: string;
};

export type ScenarioSet = {
  id: string;
  title: string;
  scenarios: Scenario[];
  createdAt?: string;
  updatedAt?: string;
};

export function getScenarioByType(scenarios: Scenario[], type: ScenarioType): Scenario | undefined {
  return scenarios.find((scenario) => scenario.type === type);
}

export function getBaseScenario(scenarios: Scenario[]): Scenario | undefined {
  return getScenarioByType(scenarios, "base");
}
