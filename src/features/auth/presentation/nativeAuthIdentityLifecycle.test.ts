/**
 * IOS-READINESS-2B-4 — native identity lifecycle orchestration races.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { AUTH_USER_QUERY_KEY } from "@/hooks/useAuth";
import { getAuthIdentityTransitionController } from "@/lib/auth-query-lifecycle";

const readNativeAuthSession = vi.fn();
const signOutNativeSession = vi.fn();
const completeNativeOAuthSignIn = vi.fn();

vi.mock("../infrastructure/readNativeAuthSession", () => ({
  readNativeAuthSession: (...args: unknown[]) => readNativeAuthSession(...args),
}));

vi.mock("../infrastructure/signOutNativeSession", () => ({
  signOutNativeSession: (...args: unknown[]) => signOutNativeSession(...args),
}));

vi.mock("../application/completeNativeOAuthSignIn", () => ({
  completeNativeOAuthSignIn: (...args: unknown[]) => completeNativeOAuthSignIn(...args),
}));

import {
  observeNativeAuthIdentity,
  signOutNativeAuthIdentity,
  completeAndPublishNativeOAuth,
} from "./nativeAuthIdentityLifecycle";

const userA = { id: "user-a", email: "a@example.com" };
const userB = { id: "user-b", email: "b@example.com" };

function seed(qc: QueryClient) {
  qc.setQueryData(AUTH_USER_QUERY_KEY, userA);
  qc.setQueryData(["projects"] as QueryKey, [{ id: "p-a" }]);
}

beforeEach(() => {
  readNativeAuthSession.mockReset();
  signOutNativeSession.mockReset();
  completeNativeOAuthSignIn.mockReset();
  signOutNativeSession.mockResolvedValue(undefined);
  completeNativeOAuthSignIn.mockResolvedValue({
    kind: "authenticated",
    user: userB,
    destination: "/dashboard",
  });
});

describe("observeNativeAuthIdentity", () => {
  it("publishes B only after purging A non-auth queries", async () => {
    const qc = new QueryClient();
    seed(qc);
    getAuthIdentityTransitionController(qc);
    readNativeAuthSession.mockResolvedValue({ kind: "authenticated", user: userB });

    const outcome = await observeNativeAuthIdentity(qc);
    expect(outcome).toEqual({ kind: "authenticated", user: userB });
    expect(qc.getQueryData(AUTH_USER_QUERY_KEY)).toEqual(userB);
    expect(qc.getQueryData(["projects"] as QueryKey)).toBeUndefined();
  });

  it("does not commit null on indeterminate; preserves A", async () => {
    const qc = new QueryClient();
    seed(qc);
    getAuthIdentityTransitionController(qc);
    readNativeAuthSession.mockResolvedValue({ kind: "indeterminate" });

    const outcome = await observeNativeAuthIdentity(qc);
    expect(outcome.kind).toBe("indeterminate");
    expect(qc.getQueryData(AUTH_USER_QUERY_KEY)).toEqual(userA);
    expect(qc.getQueryData(["projects"] as QueryKey)).toEqual([{ id: "p-a" }]);
  });

  it("authoritative signed-out applies A→null purge", async () => {
    const qc = new QueryClient();
    seed(qc);
    getAuthIdentityTransitionController(qc);
    readNativeAuthSession.mockResolvedValue({ kind: "signed-out" });

    await observeNativeAuthIdentity(qc);
    expect(qc.getQueryData(AUTH_USER_QUERY_KEY)).toBeNull();
    expect(qc.getQueryData(["projects"] as QueryKey)).toBeUndefined();
  });
});

describe("signOutNativeAuthIdentity", () => {
  it("clears session then publishes null with purge", async () => {
    const qc = new QueryClient();
    seed(qc);
    getAuthIdentityTransitionController(qc);

    const order: string[] = [];
    signOutNativeSession.mockImplementation(async () => {
      order.push("signOut");
    });
    const origSet = qc.setQueryData.bind(qc);
    vi.spyOn(qc, "setQueryData").mockImplementation((key, value) => {
      if (Array.isArray(key) && key[0] === "auth") {
        order.push(`auth:${value === null ? "null" : "user"}`);
      }
      return origSet(key, value);
    });

    await signOutNativeAuthIdentity(qc);
    expect(order[0]).toBe("signOut");
    expect(order).toContain("auth:null");
    expect(qc.getQueryData(AUTH_USER_QUERY_KEY)).toBeNull();
    expect(qc.getQueryData(["projects"] as QueryKey)).toBeUndefined();
  });

  it("does not publish null when signOut fails", async () => {
    const qc = new QueryClient();
    seed(qc);
    getAuthIdentityTransitionController(qc);
    signOutNativeSession.mockRejectedValue(new Error("Unable to sign out. Please try again."));

    await expect(signOutNativeAuthIdentity(qc)).rejects.toThrow(/Unable to sign out/);
    expect(qc.getQueryData(AUTH_USER_QUERY_KEY)).toEqual(userA);
    expect(qc.getQueryData(["projects"] as QueryKey)).toEqual([{ id: "p-a" }]);
  });
});

describe("completeAndPublishNativeOAuth", () => {
  it("serializes exchange then AUTH publish with A→B purge", async () => {
    const qc = new QueryClient();
    seed(qc);
    getAuthIdentityTransitionController(qc);

    const order: string[] = [];
    completeNativeOAuthSignIn.mockImplementation(async () => {
      order.push("exchange");
      return { kind: "authenticated", user: userB, destination: "/projects" };
    });
    const origSet = qc.setQueryData.bind(qc);
    vi.spyOn(qc, "setQueryData").mockImplementation((key, value) => {
      if (Array.isArray(key) && key[0] === "auth") {
        order.push(`auth:${(value as { id?: string } | null)?.id ?? "null"}`);
      }
      return origSet(key, value);
    });

    const result = await completeAndPublishNativeOAuth(qc, {
      callbackUrl: "com.refurbgenius.app://auth/callback?code=x",
    });
    expect(result).toEqual({ user: userB, destination: "/projects" });
    expect(order[0]).toBe("exchange");
    expect(order).toContain("auth:user-b");
    expect(qc.getQueryData(["projects"] as QueryKey)).toBeUndefined();
  });

  it("does not seed AUTH on completion error", async () => {
    const qc = new QueryClient();
    seed(qc);
    getAuthIdentityTransitionController(qc);
    completeNativeOAuthSignIn.mockResolvedValue({
      kind: "error",
      message: "Sign-in failed.",
    });

    await expect(
      completeAndPublishNativeOAuth(qc, {
        callbackUrl: "com.refurbgenius.app://auth/callback?code=x",
      }),
    ).rejects.toThrow("Sign-in failed.");
    expect(qc.getQueryData(AUTH_USER_QUERY_KEY)).toEqual(userA);
  });
});

describe("stale-read vs later transition (no RQ late write)", () => {
  it("controller publish after concurrent observe is ordered; final identity is last authoritative", async () => {
    const qc = new QueryClient();
    seed(qc);
    const controller = getAuthIdentityTransitionController(qc);

    let releaseRead: () => void = () => {};
    const gate = new Promise<void>((r) => {
      releaseRead = r;
    });

    const slow = controller.observe(async () => {
      await gate;
      return { kind: "authenticated", user: userB };
    });
    const signOut = controller.runSerialized(async ({ applyTransition }) => {
      await applyTransition(null);
    });

    releaseRead();
    await slow;
    await signOut;

    // Observe(B) completed first then null — final is null
    expect(qc.getQueryData(AUTH_USER_QUERY_KEY)).toBeNull();
  });
});
