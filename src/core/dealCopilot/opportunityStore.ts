// Supabase-backed opportunity store. Preserves a synchronous external-store
// API (list / getById / subscribe) by caching results in memory and notifying
// subscribers when async fetches complete.
import { supabase } from "@/integrations/supabase/client";
import { auth } from "@/lib/auth";

import type { DealOpportunity, DealOpportunityStatus } from "./opportunity";

export type OpportunityStoreSnapshot = {
  opportunities: DealOpportunity[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

let cache: DealOpportunity[] = [];
let loaded = false;
let loading: Promise<void> | null = null;
let waitingForAuth = false;
let storeError: string | null = null;
let snapshot: OpportunityStoreSnapshot = {
  opportunities: cache,
  loading: false,
  loaded,
  error: storeError,
};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToOpportunity(r: any): DealOpportunity {
  return {
    id: r.id,
    title: r.title,
    listingUrl: r.listing_url ?? undefined,
    postcode: r.postcode ?? undefined,
    propertyType: r.property_type ?? undefined,
    bedrooms: r.bedrooms != null ? Number(r.bedrooms) : undefined,
    purchasePrice: r.purchase_price != null ? Number(r.purchase_price) : undefined,
    estimatedGdv: r.estimated_gdv != null ? Number(r.estimated_gdv) : undefined,
    expectedMonthlyRent:
      r.expected_monthly_rent != null ? Number(r.expected_monthly_rent) : undefined,
    refurbBudget: r.refurb_budget != null ? Number(r.refurb_budget) : undefined,
    targetExitStrategy: r.target_exit_strategy ?? undefined,
    status: r.status as DealOpportunityStatus,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function fetchAll(): Promise<void> {
  if (!auth.getUser()) {
    cache = [];
    loaded = true;
    waitingForAuth = false;
    storeError = null;
    notify();
    return;
  }
  const { data, error } = await supabase
    .from("deal_opportunities")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[deal-opportunities] fetch failed", error);
    cache = [];
    loaded = true;
    waitingForAuth = false;
    storeError = error.message;
  } else {
    cache = (data ?? []).map(rowToOpportunity);
    loaded = true;
    waitingForAuth = false;
    storeError = null;
  }
  notify();
}

function ensureLoaded() {
  if (loaded || loading) return;
  if (!auth.getUser()) {
    waitingForAuth = true;
    return;
  }
  waitingForAuth = false;
  loading = fetchAll().finally(() => {
    loading = null;
    notify();
  });
}

function buildSnapshot(): OpportunityStoreSnapshot {
  const isLoading = Boolean(loading) || waitingForAuth;
  if (
    snapshot.opportunities !== cache ||
    snapshot.loading !== isLoading ||
    snapshot.loaded !== loaded ||
    snapshot.error !== storeError
  ) {
    snapshot = { opportunities: cache, loading: isLoading, loaded, error: storeError };
  }
  return snapshot;
}

if (typeof window !== "undefined") {
  auth.onChange(() => {
    loaded = false;
    waitingForAuth = false;
    storeError = null;
    cache = [];
    notify();
    if (auth.getUser()) {
      ensureLoaded();
    } else {
      loaded = true;
      notify();
    }
  });
}

export const opportunityStore = {
  list(): DealOpportunity[] {
    ensureLoaded();
    return cache;
  },
  getById(id: string): DealOpportunity | undefined {
    ensureLoaded();
    return cache.find((o) => o.id === id);
  },
  getSnapshot(): OpportunityStoreSnapshot {
    ensureLoaded();
    return buildSnapshot();
  },
  async refresh(): Promise<void> {
    await fetchAll();
  },
  async save(opportunity: DealOpportunity): Promise<DealOpportunity> {
    const user = auth.getUser();
    if (!user) throw new Error("You must be signed in.");
    const { data, error } = await supabase
      .from("deal_opportunities")
      .insert({
        id: opportunity.id,
        user_id: user.id,
        title: opportunity.title,
        listing_url: opportunity.listingUrl ?? null,
        postcode: opportunity.postcode ?? null,
        property_type: opportunity.propertyType ?? null,
        bedrooms: opportunity.bedrooms ?? null,
        purchase_price: opportunity.purchasePrice ?? null,
        estimated_gdv: opportunity.estimatedGdv ?? null,
        expected_monthly_rent: opportunity.expectedMonthlyRent ?? null,
        refurb_budget: opportunity.refurbBudget ?? null,
        target_exit_strategy: opportunity.targetExitStrategy ?? null,
        status: opportunity.status,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const saved = rowToOpportunity(data);
    cache = [saved, ...cache.filter((o) => o.id !== saved.id)];
    notify();
    return saved;
  },
  async update(
    id: string,
    updates: Partial<Omit<DealOpportunity, "id" | "createdAt" | "updatedAt">>,
  ): Promise<DealOpportunity> {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.listingUrl !== undefined) patch.listing_url = updates.listingUrl;
    if (updates.postcode !== undefined) patch.postcode = updates.postcode;
    if (updates.propertyType !== undefined) patch.property_type = updates.propertyType;
    if (updates.bedrooms !== undefined) patch.bedrooms = updates.bedrooms;
    if (updates.purchasePrice !== undefined) patch.purchase_price = updates.purchasePrice;
    if (updates.estimatedGdv !== undefined) patch.estimated_gdv = updates.estimatedGdv;
    if (updates.expectedMonthlyRent !== undefined)
      patch.expected_monthly_rent = updates.expectedMonthlyRent;
    if (updates.refurbBudget !== undefined) patch.refurb_budget = updates.refurbBudget;
    if (updates.targetExitStrategy !== undefined)
      patch.target_exit_strategy = updates.targetExitStrategy;
    if (updates.status !== undefined) patch.status = updates.status;

    const { data, error } = await supabase
      .from("deal_opportunities")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const updated = rowToOpportunity(data);
    cache = cache.map((o) => (o.id === id ? updated : o));
    notify();
    return updated;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("deal_opportunities").delete().eq("id", id);
    if (error) throw new Error(error.message);
    cache = cache.filter((o) => o.id !== id);
    notify();
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

// Named function exports preserve existing call-sites.
// Read functions are synchronous (return from in-memory cache).
// Write functions are async (persist to Supabase then update cache).

export function listDealOpportunities(): DealOpportunity[] {
  return opportunityStore.list();
}

export function getDealOpportunityById(id: string): DealOpportunity | null {
  return opportunityStore.getById(id) ?? null;
}

export async function saveDealOpportunity(
  opportunity: DealOpportunity,
): Promise<DealOpportunity> {
  return opportunityStore.save(opportunity);
}

export async function updateDealOpportunity(
  id: string,
  updates: Partial<Omit<DealOpportunity, "id" | "createdAt">>,
): Promise<DealOpportunity | null> {
  try {
    return await opportunityStore.update(id, updates);
  } catch {
    return null;
  }
}

export async function deleteDealOpportunity(id: string): Promise<boolean> {
  try {
    await opportunityStore.delete(id);
    return true;
  } catch {
    return false;
  }
}

export function clearDealOpportunityStore(): void {
  cache = [];
  loaded = false;
  notify();
}

