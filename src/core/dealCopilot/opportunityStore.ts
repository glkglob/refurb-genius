// Supabase-backed opportunity store. Preserves a synchronous external-store
// API (list / getById / subscribe) by caching results in memory and notifying
// subscribers when async fetches complete.
import { supabase } from "@/platform/supabase/browser";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import type { Tables } from "@repo/supabase";

import type { DealOpportunity, DealOpportunityStatus, DealExitStrategy } from "@repo/types";
import type { PropertyType } from "@/core/projects/domain";

// NEW: server-backed save for the "Save opportunity" flow in Deal Copilot.
// This is the critical write path that must survive hard refresh / direct nav
// to /deal-copilot/new (and the intake form).
import {
  saveDealOpportunityServerFn,
  deleteDealOpportunityServerFn,
} from "@/serverFns/dealCopilot";

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

function rowToOpportunity(r: Tables<"deal_opportunities">): DealOpportunity {
  return {
    id: r.id,
    title: r.title,
    listingUrl: r.listing_url ?? undefined,
    postcode: r.postcode ?? undefined,
    propertyType: (r.property_type ?? undefined) as PropertyType | undefined,
    bedrooms: r.bedrooms != null ? Number(r.bedrooms) : undefined,
    purchasePrice: r.purchase_price != null ? Number(r.purchase_price) : undefined,
    estimatedGdv: r.estimated_gdv != null ? Number(r.estimated_gdv) : undefined,
    expectedMonthlyRent:
      r.expected_monthly_rent != null ? Number(r.expected_monthly_rent) : undefined,
    refurbBudget: r.refurb_budget != null ? Number(r.refurb_budget) : undefined,
    targetExitStrategy: (r.target_exit_strategy ?? undefined) as DealExitStrategy | undefined,
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
    logger.error("[deal-opportunities] fetch failed", { error: String(error) });
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
    /**
     * THE FIX FOR DEAL COPILOT "SAVE OPPORTUNITY" AFTER HARD REFRESH
     *
     * Old code (now deleted from this path):
     *   const user = auth.getUser(); if (!user) throw ...
     *   await supabase.from("deal_opportunities").insert({ user_id: user.id, ... })
     *
     * This used the browser client's in-memory auth, which is empty on hard
     * refresh or when landing directly on /deal-copilot/new. The form's
     * handleSaveOpportunity would then fail with "You must be signed in."
     *
     * New behaviour:
     *   - Call the serverFn (executes on Nitro server)
     *   - serverFn calls requireUser() → validates via request cookies
     *   - serverFn performs the INSERT with the real user.id
     *   - serverFn returns a ready-to-use DealOpportunity (already mapped)
     *
     * We still do the local cache/notify dance here (the store's job) so
     * subscribers (any components using opportunityStore) see the update
     * synchronously after the await.
     */
    const saved = await saveDealOpportunityServerFn({ data: opportunity });

    // Maintain the exact same cache-merge + notify contract as before.
    cache = [saved, ...cache.filter((o) => o.id !== saved.id)];
    notify();
    return saved;
  },
  async delete(id: string): Promise<void> {
    // Use serverFn for hard-refresh safety + consistent auth (mirrors save path).
    await deleteDealOpportunityServerFn({ data: { id } });
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

export async function saveDealOpportunity(opportunity: DealOpportunity): Promise<DealOpportunity> {
  return opportunityStore.save(opportunity);
}

export async function deleteDealOpportunity(id: string): Promise<void> {
  try {
    await opportunityStore.delete(id);
  } catch (error) {
    logger.error("[deal-opportunities] delete failed", { id, error: String(error) });
    throw error;
  }
}

export function clearDealOpportunityStore(): void {
  cache = [];
  loaded = false;
  notify();
}
