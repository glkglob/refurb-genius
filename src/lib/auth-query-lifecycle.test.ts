import { describe, it, expect, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import {
  AUTH_USER_QUERY_KEY_SEGMENTS,
  UNRESOLVED_AUTH_IDENTITY,
  isAuthUserQueryKey,
  getAuthIdentity,
  isAuthIdentityBoundary,
  applyAuthQueryCacheTransition,
} from "./auth-query-lifecycle";

const AUTH_KEY = [...AUTH_USER_QUERY_KEY_SEGMENTS] as unknown as QueryKey;

const userA = { id: "user-a", email: "a@example.com" };
const userARefreshed = { id: "user-a", email: "a+refreshed@example.com", fullName: "A" };
const userB = { id: "user-b", email: "b@example.com" };

function seedCaches(qc: QueryClient, authUser: typeof userA | null = userA) {
  qc.setQueryData(AUTH_KEY, authUser);
  qc.setQueryData(["projects"] as QueryKey, [{ id: "p1", owner: authUser?.id }]);
  qc.setQueryData(["projects", "project-1"] as QueryKey, { id: "project-1" });
  qc.setQueryData(["projects", "project-1", "photos"] as QueryKey, [{ id: "ph1" }]);
  qc.setQueryData(["opportunities"] as QueryKey, [{ id: "o1" }]);
  qc.setQueryData(["gallery", "public"] as QueryKey, [{ id: "g1" }]);
}

describe("isAuthUserQueryKey", () => {
  it("preserves only the exact canonical auth key", () => {
    expect(isAuthUserQueryKey(["auth", "currentUser"])).toBe(true);
    expect(isAuthUserQueryKey(["auth"])).toBe(false);
    expect(isAuthUserQueryKey(["auth", "other"])).toBe(false);
    expect(isAuthUserQueryKey(["auth", "currentUser", "extra"])).toBe(false);
    expect(isAuthUserQueryKey(["projects"])).toBe(false);
  });
});

describe("getAuthIdentity / isAuthIdentityBoundary", () => {
  it("extracts stable ids", () => {
    expect(getAuthIdentity(userA)).toBe("user-a");
    expect(getAuthIdentity(null)).toBeNull();
  });

  it("classifies transitions", () => {
    expect(isAuthIdentityBoundary(UNRESOLVED_AUTH_IDENTITY, null)).toBe(false);
    expect(isAuthIdentityBoundary(UNRESOLVED_AUTH_IDENTITY, userA)).toBe(false);
    expect(isAuthIdentityBoundary(null, null)).toBe(false);
    expect(isAuthIdentityBoundary(null, userA)).toBe(false);
    expect(isAuthIdentityBoundary("user-a", userA)).toBe(false);
    expect(isAuthIdentityBoundary("user-a", userARefreshed)).toBe(false);
    expect(isAuthIdentityBoundary("user-a", null)).toBe(true);
    expect(isAuthIdentityBoundary("user-a", userB)).toBe(true);
  });
});

describe("applyAuthQueryCacheTransition", () => {
  it("unresolved → A does not remove non-auth cache", async () => {
    const qc = new QueryClient();
    seedCaches(qc, null);
    // Simulate residual data present before first observation
    qc.setQueryData(["projects"] as QueryKey, [{ id: "stale" }]);

    const result = await applyAuthQueryCacheTransition(qc, UNRESOLVED_AUTH_IDENTITY, userA);
    expect(result.boundaryApplied).toBe(false);
    expect(result.nextPreviousIdentity).toBe("user-a");
    expect(qc.getQueryData(AUTH_KEY)).toEqual(userA);
    expect(qc.getQueryData(["projects"] as QueryKey)).toEqual([{ id: "stale" }]);
  });

  it("unresolved → null does not remove non-auth cache", async () => {
    const qc = new QueryClient();
    seedCaches(qc, userA);
    const result = await applyAuthQueryCacheTransition(qc, UNRESOLVED_AUTH_IDENTITY, null);
    expect(result.boundaryApplied).toBe(false);
    expect(result.nextPreviousIdentity).toBeNull();
    expect(qc.getQueryData(["projects"] as QueryKey)).toBeDefined();
    expect(qc.getQueryData(AUTH_KEY)).toBeNull();
  });

  it("null → null is a no-op destructive work", async () => {
    const qc = new QueryClient();
    const cancelSpy = vi.spyOn(qc, "cancelQueries");
    const removeSpy = vi.spyOn(qc, "removeQueries");
    const result = await applyAuthQueryCacheTransition(qc, null, null);
    expect(result.boundaryApplied).toBe(false);
    expect(cancelSpy).not.toHaveBeenCalled();
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it("null → A does not purge", async () => {
    const qc = new QueryClient();
    qc.setQueryData(["projects"] as QueryKey, [{ id: "x" }]);
    const result = await applyAuthQueryCacheTransition(qc, null, userA);
    expect(result.boundaryApplied).toBe(false);
    expect(qc.getQueryData(["projects"] as QueryKey)).toEqual([{ id: "x" }]);
    expect(qc.getQueryData(AUTH_KEY)).toEqual(userA);
  });

  it("A → refreshed A updates auth only", async () => {
    const qc = new QueryClient();
    seedCaches(qc, userA);
    const cancelSpy = vi.spyOn(qc, "cancelQueries");
    const result = await applyAuthQueryCacheTransition(qc, "user-a", userARefreshed);
    expect(result.boundaryApplied).toBe(false);
    expect(cancelSpy).not.toHaveBeenCalled();
    expect(qc.getQueryData(AUTH_KEY)).toEqual(userARefreshed);
    expect(qc.getQueryData(["projects"] as QueryKey)).toBeDefined();
  });

  it("A → null cancels then removes non-auth and sets auth null", async () => {
    const qc = new QueryClient();
    seedCaches(qc, userA);

    const order: string[] = [];
    const origCancel = qc.cancelQueries.bind(qc);
    const origRemove = qc.removeQueries.bind(qc);
    const origSet = qc.setQueryData.bind(qc);
    vi.spyOn(qc, "cancelQueries").mockImplementation(async (...args) => {
      order.push("cancelQueries");
      return origCancel(...args);
    });
    vi.spyOn(qc, "removeQueries").mockImplementation((...args) => {
      order.push("removeQueries");
      return origRemove(...args);
    });
    vi.spyOn(qc, "setQueryData").mockImplementation((...args) => {
      order.push("setQueryData");
      return origSet(...args);
    });

    const result = await applyAuthQueryCacheTransition(qc, "user-a", null);
    expect(result.boundaryApplied).toBe(true);
    expect(result.nextPreviousIdentity).toBeNull();
    expect(order).toEqual(["cancelQueries", "removeQueries", "setQueryData"]);

    expect(qc.getQueryData(AUTH_KEY)).toBeNull();
    expect(qc.getQueryData(["projects"] as QueryKey)).toBeUndefined();
    expect(qc.getQueryData(["projects", "project-1"] as QueryKey)).toBeUndefined();
    expect(qc.getQueryData(["projects", "project-1", "photos"] as QueryKey)).toBeUndefined();
    expect(qc.getQueryData(["opportunities"] as QueryKey)).toBeUndefined();
    expect(qc.getQueryData(["gallery", "public"] as QueryKey)).toBeUndefined();
  });

  it("A → B purges all user A data and sets auth to B", async () => {
    const qc = new QueryClient();
    seedCaches(qc, userA);
    const result = await applyAuthQueryCacheTransition(qc, "user-a", userB);
    expect(result.boundaryApplied).toBe(true);
    expect(result.nextPreviousIdentity).toBe("user-b");
    expect(qc.getQueryData(AUTH_KEY)).toEqual(userB);
    expect(qc.getQueryData(["projects"] as QueryKey)).toBeUndefined();
    expect(qc.getQueryData(["projects", "project-1"] as QueryKey)).toBeUndefined();
    expect(qc.getQueryData(["gallery", "public"] as QueryKey)).toBeUndefined();
  });

  it("A → null then null → null only applies boundary once", async () => {
    const qc = new QueryClient();
    seedCaches(qc, userA);
    const first = await applyAuthQueryCacheTransition(qc, "user-a", null);
    expect(first.boundaryApplied).toBe(true);
    const cancelSpy = vi.spyOn(qc, "cancelQueries");
    const second = await applyAuthQueryCacheTransition(qc, null, null);
    expect(second.boundaryApplied).toBe(false);
    expect(cancelSpy).not.toHaveBeenCalled();
  });

  it("A → B then B → refreshed B only applies boundary once", async () => {
    const qc = new QueryClient();
    seedCaches(qc, userA);
    await applyAuthQueryCacheTransition(qc, "user-a", userB);
    qc.setQueryData(["projects"] as QueryKey, [{ id: "b-project" }]);
    const cancelSpy = vi.spyOn(qc, "cancelQueries");
    const second = await applyAuthQueryCacheTransition(qc, "user-b", {
      id: "user-b",
    } as typeof userB);
    expect(second.boundaryApplied).toBe(false);
    expect(cancelSpy).not.toHaveBeenCalled();
    expect(qc.getQueryData(["projects"] as QueryKey)).toEqual([{ id: "b-project" }]);
  });

  it("serializes rapid A → null → B without leaving A data", async () => {
    const qc = new QueryClient();
    seedCaches(qc, userA);

    let releaseCancel: () => void = () => {};
    const cancelGate = new Promise<void>((resolve) => {
      releaseCancel = resolve;
    });

    const origCancel = qc.cancelQueries.bind(qc);
    vi.spyOn(qc, "cancelQueries").mockImplementation(async (...args) => {
      await cancelGate;
      return origCancel(...args);
    });

    let previous: typeof UNRESOLVED_AUTH_IDENTITY | string | null = "user-a";
    let chain = Promise.resolve();

    const enqueue = (next: typeof userA | null) => {
      chain = chain.then(async () => {
        const result = await applyAuthQueryCacheTransition(qc, previous, next);
        previous = result.nextPreviousIdentity;
      });
      return chain;
    };

    const p1 = enqueue(null);
    const p2 = enqueue(userB);
    releaseCancel();
    await p1;
    await p2;

    expect(previous).toBe("user-b");
    expect(qc.getQueryData(AUTH_KEY)).toEqual(userB);
    expect(qc.getQueryData(["projects"] as QueryKey)).toBeUndefined();
  });

  it("in-flight non-auth fetch cancelled on boundary does not leave A data", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    qc.setQueryData(AUTH_KEY, userA);

    let resolveFetch: (v: unknown) => void = () => {};
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    const queryPromise = qc.fetchQuery({
      queryKey: ["slow-projects"] as QueryKey,
      queryFn: async ({ signal }) => {
        await fetchPromise;
        if (signal?.aborted) {
          const err = new Error("Aborted");
          err.name = "AbortError";
          throw err;
        }
        return [{ id: "from-a" }];
      },
    });

    // Allow fetch to start
    await Promise.resolve();

    const transition = applyAuthQueryCacheTransition(qc, "user-a", null);
    resolveFetch(undefined);
    await transition;

    await expect(queryPromise).rejects.toThrow();
    expect(qc.getQueryData(["slow-projects"] as QueryKey)).toBeUndefined();
    expect(qc.getQueryData(AUTH_KEY)).toBeNull();
  });
});
