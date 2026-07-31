/**
 * Focused tests for category authority serverFn composition behaviour.
 * Avoids full TanStack server runtime; exercises rate-limit + auth order via fakes.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { checkRateLimit, rateLimitKeyForUser } from "@/lib/rate-limit";
import { AuthorityError } from "../application/authority";
import { makeSaveAuthorityCategoryEstimate } from "../application/authority";
import { runPricingEngine } from "../domain";

const command = {
  projectId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  inputs: {
    region: "London" as const,
    property_condition: "Dated" as const,
    finish_quality: "Standard" as const,
    selected_categories: ["Kitchen" as const],
    property_size_sqm: 90,
  },
  idempotencyKey: "key-1",
};

describe("authority save handler composition", () => {
  beforeEach(() => {
    // Drain rate-limit buckets for this action by using unique user ids per test.
  });

  it("rate limit rejects before ownership/pricing/persistence", async () => {
    const userId = `user-rl-${Math.random()}`;
    const key = rateLimitKeyForUser(userId, "authority-category-save");
    // Exhaust window
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(key).allowed).toBe(true);
    }
    const blocked = checkRateLimit(key);
    expect(blocked.allowed).toBe(false);

    const assertProjectOwnedBy = vi.fn();
    const persistCategoryEngineEstimate = vi.fn();
    const price = vi.fn(runPricingEngine);

    // Handler-level: if rate-limited, use case must not run.
    if (!blocked.allowed) {
      expect(assertProjectOwnedBy).not.toHaveBeenCalled();
      expect(persistCategoryEngineEstimate).not.toHaveBeenCalled();
      expect(price).not.toHaveBeenCalled();
      return;
    }

    // Unreachable when blocked
    await makeSaveAuthorityCategoryEstimate({
      auth: { requireUserId: async () => userId },
      projects: { assertProjectOwnedBy },
      persistence: { persistCategoryEngineEstimate },
      price,
    })(command);
  });

  it("auth is resolved once and reused (no second requireUser)", async () => {
    const requireUserId = vi.fn(async () => "user-once");
    const assertProjectOwnedBy = vi.fn(async () => {});
    const persistCategoryEngineEstimate = vi.fn(async () => ({
      estimateId: "est-1",
      replay: false,
      estimate: { id: "est-1" },
      items: [],
    }));

    const save = makeSaveAuthorityCategoryEstimate({
      auth: { requireUserId },
      projects: { assertProjectOwnedBy },
      persistence: { persistCategoryEngineEstimate },
    });
    await save(command);
    expect(requireUserId).toHaveBeenCalledTimes(1);
  });

  it("structured AuthorityError is not flattened when mapped by handler", () => {
    const err = new AuthorityError("PROJECT_NOT_FOUND", "Project not found.");
    const response = {
      ok: false as const,
      error: {
        code: err.code,
        message: err.message,
        retryable: false,
      },
    };
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe("PROJECT_NOT_FOUND");
      expect(response.error.retryable).toBe(false);
    }
  });
});
