import type { DealOpportunity } from "./opportunity";

const opportunities = new Map<string, DealOpportunity>();

export function saveDealOpportunity(opportunity: DealOpportunity): DealOpportunity {
  opportunities.set(opportunity.id, opportunity);
  return opportunity;
}

export function listDealOpportunities(): DealOpportunity[] {
  return Array.from(opportunities.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getDealOpportunityById(id: string): DealOpportunity | null {
  return opportunities.get(id) ?? null;
}

export function updateDealOpportunity(
  id: string,
  updates: Partial<Omit<DealOpportunity, "id" | "createdAt">>,
  now = new Date(),
): DealOpportunity | null {
  const current = opportunities.get(id);

  if (!current) {
    return null;
  }

  const updated: DealOpportunity = {
    ...current,
    ...updates,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: now.toISOString(),
  };

  opportunities.set(id, updated);
  return updated;
}

export function deleteDealOpportunity(id: string): boolean {
  return opportunities.delete(id);
}

export function clearDealOpportunityStore(): void {
  opportunities.clear();
}
