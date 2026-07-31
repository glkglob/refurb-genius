import { describe, expect, it, vi } from "vitest";
import { makeSaveAuthorityCategoryEstimate } from "./saveAuthorityCategoryEstimate";
import { CATEGORY_PRICING_POLICY_VERSION } from "./authorityCommandPolicy";
import { AuthorityError } from "./authorityErrors";
import type { SaveAuthorityCategoryEstimateCommand } from "./decodeSaveAuthorityCategoryEstimateCommand";
import { runPricingEngine } from "../../domain";

const command: SaveAuthorityCategoryEstimateCommand = {
  projectId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  inputs: {
    region: "London",
    property_condition: "Dated",
    finish_quality: "Standard",
    selected_categories: ["Kitchen"],
    property_size_sqm: 90,
  },
  idempotencyKey: "key-1",
};

describe("makeSaveAuthorityCategoryEstimate", () => {
  it("derives owner from session, prices on server, persists server output", async () => {
    const requireUserId = vi.fn(async () => "user-owner-1");
    const assertProjectOwnedBy = vi.fn(async () => {});
    const persistCategoryEngineEstimate = vi.fn(async (input) => ({
      estimateId: "est-1",
      replay: false,
      estimate: { id: "est-1" },
      items: [],
    }));
    const price = vi.fn(runPricingEngine);

    const save = makeSaveAuthorityCategoryEstimate({
      auth: { requireUserId },
      projects: { assertProjectOwnedBy },
      persistence: { persistCategoryEngineEstimate },
      price,
    });

    const result = await save(command);

    expect(requireUserId).toHaveBeenCalledTimes(1);
    expect(assertProjectOwnedBy).toHaveBeenCalledWith(command.projectId, "user-owner-1");
    expect(price).toHaveBeenCalledWith(command.inputs);
    expect(persistCategoryEngineEstimate).toHaveBeenCalledTimes(1);
    const persistArg = persistCategoryEngineEstimate.mock.calls[0]![0];
    expect(persistArg.expectedOwnerId).toBe("user-owner-1");
    expect(persistArg.pricingPolicyVersion).toBe(CATEGORY_PRICING_POLICY_VERSION);
    expect(persistArg.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(persistArg.pricing.mid_total).toBe(result.pricing.mid_total);
    expect(result.estimateId).toBe("est-1");
  });

  it("does not accept user ID from the command (command has no userId field)", async () => {
    const requireUserId = vi.fn(async () => "session-user");
    const assertProjectOwnedBy = vi.fn(async () => {});
    const persistCategoryEngineEstimate = vi.fn(async () => ({
      estimateId: "est-1",
      replay: false,
      estimate: {},
      items: [],
    }));
    const save = makeSaveAuthorityCategoryEstimate({
      auth: { requireUserId },
      projects: { assertProjectOwnedBy },
      persistence: { persistCategoryEngineEstimate },
    });
    await save(command);
    expect(persistCategoryEngineEstimate).toHaveBeenCalledWith(
      expect.objectContaining({ expectedOwnerId: "session-user" }),
    );
  });

  it("ownership failure skips engine and persistence", async () => {
    const price = vi.fn(runPricingEngine);
    const persistCategoryEngineEstimate = vi.fn();
    const save = makeSaveAuthorityCategoryEstimate({
      auth: { requireUserId: async () => "user-1" },
      projects: {
        assertProjectOwnedBy: async () => {
          throw new AuthorityError("PROJECT_OWNERSHIP_CHANGED", "nope");
        },
      },
      persistence: { persistCategoryEngineEstimate },
      price,
    });

    await expect(save(command)).rejects.toMatchObject({ code: "PROJECT_OWNERSHIP_CHANGED" });
    expect(price).not.toHaveBeenCalled();
    expect(persistCategoryEngineEstimate).not.toHaveBeenCalled();
  });

  it("engine failure causes no persistence call", async () => {
    const persistCategoryEngineEstimate = vi.fn();
    const save = makeSaveAuthorityCategoryEstimate({
      auth: { requireUserId: async () => "user-1" },
      projects: { assertProjectOwnedBy: async () => {} },
      persistence: { persistCategoryEngineEstimate },
      price: () => {
        throw new Error("engine down");
      },
    });
    await expect(save(command)).rejects.toThrow("engine down");
    expect(persistCategoryEngineEstimate).not.toHaveBeenCalled();
  });

  it("maps persistence IDEMPOTENCY_CONFLICT through", async () => {
    const save = makeSaveAuthorityCategoryEstimate({
      auth: { requireUserId: async () => "user-1" },
      projects: { assertProjectOwnedBy: async () => {} },
      persistence: {
        persistCategoryEngineEstimate: async () => {
          throw new AuthorityError("IDEMPOTENCY_CONFLICT", "conflict");
        },
      },
    });
    await expect(save(command)).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("existing pricing formula output remains unchanged", async () => {
    const expected = runPricingEngine(command.inputs);
    const save = makeSaveAuthorityCategoryEstimate({
      auth: { requireUserId: async () => "user-1" },
      projects: { assertProjectOwnedBy: async () => {} },
      persistence: {
        persistCategoryEngineEstimate: async ({ pricing }) => {
          expect(pricing).toEqual(expected);
          return { estimateId: "e", replay: false, estimate: {}, items: [] };
        },
      },
    });
    const result = await save(command);
    expect(result.pricing).toEqual(expected);
  });
});
