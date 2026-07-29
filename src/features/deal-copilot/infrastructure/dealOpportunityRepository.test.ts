/**
 * AO-1M5 — dealOpportunityRepository.updateOpportunity table contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { fromMock, updateMock, eqMock, selectMock, singleMock } = vi.hoisted(() => {
  const singleMock = vi.fn();
  const selectMock = vi.fn(() => ({ single: singleMock }));
  const eqMock = vi.fn(() => ({ select: selectMock }));
  const updateMock = vi.fn((..._args: unknown[]) => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ update: updateMock }));
  return { fromMock, updateMock, eqMock, selectMock, singleMock };
});

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    from: fromMock,
  },
}));

import { updateOpportunity, dealOpportunityRepository } from "./dealOpportunityRepository";

const OPP_ID = "opp-update-1";
const FIXED_NOW = "2026-07-29T12:00:00.000Z";

const serverRow = {
  id: OPP_ID,
  user_id: "user-1",
  title: "Terrace deal",
  listing_url: "https://example.com/listing",
  postcode: "E1 1AA",
  property_type: "Terraced",
  bedrooms: 3,
  purchase_price: 300_000,
  estimated_gdv: 400_000,
  expected_monthly_rent: 2_000,
  refurb_budget: 50_000,
  target_exit_strategy: "flip",
  status: "underwriting",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: FIXED_NOW,
};

describe("updateOpportunity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FIXED_NOW));
    updateMock.mockImplementation(() => ({ eq: eqMock }));
    eqMock.mockImplementation(() => ({ select: selectMock }));
    selectMock.mockImplementation(() => ({ single: singleMock }));
    singleMock.mockResolvedValue({ data: serverRow, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses deal_opportunities update filtered by id with select().single()", async () => {
    await updateOpportunity({ id: OPP_ID, updates: { status: "watchlist" } });

    expect(fromMock).toHaveBeenCalledWith("deal_opportunities");
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(eqMock).toHaveBeenCalledWith("id", OPP_ID);
    expect(selectMock).toHaveBeenCalled();
    expect(singleMock).toHaveBeenCalled();
  });

  it("maps selected row to DealOpportunity domain shape", async () => {
    const result = await updateOpportunity({
      id: OPP_ID,
      updates: { status: "underwriting" },
    });

    expect(result).toEqual({
      id: OPP_ID,
      title: "Terrace deal",
      listingUrl: "https://example.com/listing",
      postcode: "E1 1AA",
      propertyType: "Terraced",
      bedrooms: 3,
      purchasePrice: 300_000,
      estimatedGdv: 400_000,
      expectedMonthlyRent: 2_000,
      refurbBudget: 50_000,
      targetExitStrategy: "flip",
      status: "underwriting",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: FIXED_NOW,
    });
  });

  it("maps all supported domain fields to snake_case columns", async () => {
    await updateOpportunity({
      id: OPP_ID,
      updates: {
        title: "New title",
        listingUrl: "https://example.com/x",
        postcode: "SW1A 1AA",
        propertyType: "Flat" as never,
        bedrooms: 2,
        purchasePrice: 250_000,
        estimatedGdv: 350_000,
        expectedMonthlyRent: 1_500,
        refurbBudget: 40_000,
        targetExitStrategy: "buy_to_let",
        status: "sourced",
      },
    });

    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch).toMatchObject({
      title: "New title",
      listing_url: "https://example.com/x",
      postcode: "SW1A 1AA",
      property_type: "Flat",
      bedrooms: 2,
      purchase_price: 250_000,
      estimated_gdv: 350_000,
      expected_monthly_rent: 1_500,
      refurb_budget: 40_000,
      target_exit_strategy: "buy_to_let",
      status: "sourced",
      updated_at: FIXED_NOW,
    });
  });

  it("omits fields whose value is undefined", async () => {
    await updateOpportunity({
      id: OPP_ID,
      updates: {
        status: "rejected",
        title: undefined,
        bedrooms: undefined,
      },
    });

    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch).toEqual({
      status: "rejected",
      updated_at: FIXED_NOW,
    });
    expect(patch).not.toHaveProperty("title");
    expect(patch).not.toHaveProperty("bedrooms");
    expect(patch).not.toHaveProperty("listing_url");
  });

  it("preserves numeric zero values", async () => {
    await updateOpportunity({
      id: OPP_ID,
      updates: {
        bedrooms: 0,
        purchasePrice: 0,
        estimatedGdv: 0,
        expectedMonthlyRent: 0,
        refurbBudget: 0,
      },
    });

    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch.bedrooms).toBe(0);
    expect(patch.purchase_price).toBe(0);
    expect(patch.estimated_gdv).toBe(0);
    expect(patch.expected_monthly_rent).toBe(0);
    expect(patch.refurb_budget).toBe(0);
  });

  it("preserves explicit null values when supplied", async () => {
    await updateOpportunity({
      id: OPP_ID,
      updates: {
        listingUrl: null as unknown as undefined,
        postcode: null as unknown as undefined,
      },
    });

    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch.listing_url).toBeNull();
    expect(patch.postcode).toBeNull();
  });

  it("always writes a valid ISO updated_at", async () => {
    await updateOpportunity({ id: OPP_ID, updates: { status: "sourced" } });
    const patch = updateMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch.updated_at).toBe(FIXED_NOW);
    expect(typeof patch.updated_at).toBe("string");
    expect(new Date(String(patch.updated_at)).toISOString()).toBe(FIXED_NOW);
  });

  it("throws Error(error.message) on persistence failure", async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: "RLS denied" } });
    await expect(
      updateOpportunity({ id: OPP_ID, updates: { status: "watchlist" } }),
    ).rejects.toThrow("RLS denied");
  });

  it("does not add a user_id filter", async () => {
    await updateOpportunity({ id: OPP_ID, updates: { status: "sourced" } });
    expect(eqMock).toHaveBeenCalledTimes(1);
    expect(eqMock).toHaveBeenCalledWith("id", OPP_ID);
    expect((eqMock.mock.calls as unknown as unknown[][]).some((c) => c[0] === "user_id")).toBe(
      false,
    );
  });

  it("does not use upsert or insert", async () => {
    await updateOpportunity({ id: OPP_ID, updates: { status: "sourced" } });
    const chain = fromMock.mock.results[0]?.value as Record<string, unknown>;
    expect(chain).not.toHaveProperty("upsert");
    expect(chain).not.toHaveProperty("insert");
    expect(updateMock).toHaveBeenCalled();
  });

  it("dealOpportunityRepository exposes updateOpportunity", async () => {
    await dealOpportunityRepository.updateOpportunity({
      id: OPP_ID,
      updates: { status: "sourced" },
    });
    expect(fromMock).toHaveBeenCalledWith("deal_opportunities");
  });
});
