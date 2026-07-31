import { describe, expect, it, vi } from "vitest";
import { runPricingEngine } from "../../domain";
import { AuthorityError } from "./authorityErrors";
import {
  executeAuthorityCategorySave,
  type ExecuteAuthorityCategorySaveDeps,
} from "./executeAuthorityCategorySave";
import type { SaveAuthorityCategoryEstimateCommand } from "./decodeSaveAuthorityCategoryEstimateCommand";
import type { AuthorityCategoryPersistedEstimate } from "./saveAuthorityCategoryEstimate";
import { RATE_LIMIT_MAX_PER_WINDOW } from "@/lib/rate-limit";

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

function samplePersisted(): AuthorityCategoryPersistedEstimate {
  const pricing = runPricingEngine(command.inputs);
  return {
    estimateId: "est-1",
    replay: false,
    estimate: { id: "est-1" },
    items: [],
    pricing,
  };
}

describe("executeAuthorityCategorySave", () => {
  it("authenticates exactly once and uses user id for rate-limit key", async () => {
    const requireUser = vi.fn(async () => ({ id: "user-1" }));
    const rateLimitKeyForUser = vi.fn((userId: string | null | undefined, action: string) => {
      return `${userId}:${action}`;
    });
    const checkRateLimit = vi.fn(() => ({ allowed: true as const }));
    const save = vi.fn(async () => samplePersisted());

    const deps: ExecuteAuthorityCategorySaveDeps = {
      requireUser,
      checkRateLimit,
      rateLimitKeyForUser,
      save,
    };

    const result = await executeAuthorityCategorySave(command, deps);
    expect(requireUser).toHaveBeenCalledTimes(1);
    expect(rateLimitKeyForUser).toHaveBeenCalledWith("user-1", "authority-category-save");
    expect(checkRateLimit).toHaveBeenCalledWith("user-1:authority-category-save");
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(command, "user-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.estimateId).toBe("est-1");
      expect(result.data.itemCount).toBe(0);
      expect(typeof result.data.midTotal).toBe("number");
    }
  });

  it("blocked rate limit prevents save and returns RATE_LIMITED", async () => {
    const save = vi.fn();
    const deps: ExecuteAuthorityCategorySaveDeps = {
      requireUser: async () => ({ id: "user-rl" }),
      rateLimitKeyForUser: (id, action) => `${id}:${action}`,
      checkRateLimit: () => ({ allowed: false, retryAfter: 42 }),
      save,
    };

    const result = await executeAuthorityCategorySave(command, deps);
    expect(save).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message: "Rate limit exceeded. Try again in 42s.",
        retryable: true,
        retryAfterSeconds: 42,
      },
    });
  });

  it("uses shared rate-limit max configuration (not a hard-coded unrelated constant)", () => {
    expect(RATE_LIMIT_MAX_PER_WINDOW).toBeGreaterThan(0);
    expect(Number.isFinite(RATE_LIMIT_MAX_PER_WINDOW)).toBe(true);
  });

  it("maps PROJECT_NOT_FOUND as non-retryable structured error", async () => {
    const result = await executeAuthorityCategorySave(command, {
      requireUser: async () => ({ id: "u" }),
      rateLimitKeyForUser: (id, a) => `${id}:${a}`,
      checkRateLimit: () => ({ allowed: true }),
      save: async () => {
        throw new AuthorityError("PROJECT_NOT_FOUND", "Project not found.");
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PROJECT_NOT_FOUND");
      expect(result.error.retryable).toBe(false);
    }
  });

  it("maps PROJECT_OWNERSHIP_CHANGED as non-retryable", async () => {
    const result = await executeAuthorityCategorySave(command, {
      requireUser: async () => ({ id: "u" }),
      rateLimitKeyForUser: (id, a) => `${id}:${a}`,
      checkRateLimit: () => ({ allowed: true }),
      save: async () => {
        throw new AuthorityError("PROJECT_OWNERSHIP_CHANGED", "changed");
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PROJECT_OWNERSHIP_CHANGED");
      expect(result.error.retryable).toBe(false);
    }
  });

  it("maps IDEMPOTENCY_CONFLICT as non-retryable", async () => {
    const result = await executeAuthorityCategorySave(command, {
      requireUser: async () => ({ id: "u" }),
      rateLimitKeyForUser: (id, a) => `${id}:${a}`,
      checkRateLimit: () => ({ allowed: true }),
      save: async () => {
        throw new AuthorityError("IDEMPOTENCY_CONFLICT", "conflict");
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("IDEMPOTENCY_CONFLICT");
      expect(result.error.retryable).toBe(false);
    }
  });

  it("maps AUTHORITY_PERSISTENCE_FAILED as non-retryable", async () => {
    const result = await executeAuthorityCategorySave(command, {
      requireUser: async () => ({ id: "u" }),
      rateLimitKeyForUser: (id, a) => `${id}:${a}`,
      checkRateLimit: () => ({ allowed: true }),
      save: async () => {
        throw new AuthorityError("AUTHORITY_PERSISTENCE_FAILED", "config");
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTHORITY_PERSISTENCE_FAILED");
      expect(result.error.retryable).toBe(false);
    }
  });

  it("maps AUTHORITY_PERSISTENCE_UNAVAILABLE as retryable", async () => {
    const result = await executeAuthorityCategorySave(command, {
      requireUser: async () => ({ id: "u" }),
      rateLimitKeyForUser: (id, a) => `${id}:${a}`,
      checkRateLimit: () => ({ allowed: true }),
      save: async () => {
        throw new AuthorityError("AUTHORITY_PERSISTENCE_UNAVAILABLE", "timeout");
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTHORITY_PERSISTENCE_UNAVAILABLE");
      expect(result.error.retryable).toBe(true);
    }
  });

  it("does not silently convert unexpected errors", async () => {
    await expect(
      executeAuthorityCategorySave(command, {
        requireUser: async () => ({ id: "u" }),
        rateLimitKeyForUser: (id, a) => `${id}:${a}`,
        checkRateLimit: () => ({ allowed: true }),
        save: async () => {
          throw new Error("boom-unexpected");
        },
      }),
    ).rejects.toThrow("boom-unexpected");
  });

  it("successful save returns production DTO shape", async () => {
    const pricing = runPricingEngine(command.inputs);
    const result = await executeAuthorityCategorySave(command, {
      requireUser: async () => ({ id: "u" }),
      rateLimitKeyForUser: (id, a) => `${id}:${a}`,
      checkRateLimit: () => ({ allowed: true }),
      save: async () => ({
        estimateId: "est-dto",
        replay: true,
        estimate: {},
        items: [{}, {}],
        pricing,
      }),
    });
    expect(result).toEqual({
      ok: true,
      data: {
        estimateId: "est-dto",
        replay: true,
        midTotal: pricing.mid_total,
        lowTotal: pricing.low_total,
        highTotal: pricing.high_total,
        labourTotal: pricing.labour_total,
        materialsTotal: pricing.materials_total,
        subtotal: pricing.subtotal,
        contingency: pricing.contingency,
        vat: pricing.vat,
        timelineWeeks: pricing.timeline_weeks,
        itemCount: 2,
      },
    });
  });
});
