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
const signInWithPasswordEmailNative = vi.fn();
const signUpWithPasswordEmailNative = vi.fn();

vi.mock("../infrastructure/readNativeAuthSession", () => ({
  readNativeAuthSession: (...args: unknown[]) => readNativeAuthSession(...args),
}));

vi.mock("../infrastructure/signOutNativeSession", () => ({
  signOutNativeSession: (...args: unknown[]) => signOutNativeSession(...args),
}));

vi.mock("../application/completeNativeOAuthSignIn", () => ({
  completeNativeOAuthSignIn: (...args: unknown[]) => completeNativeOAuthSignIn(...args),
}));

vi.mock("../infrastructure/signInWithPasswordEmailNative", () => ({
  signInWithPasswordEmailNative: (...args: unknown[]) => signInWithPasswordEmailNative(...args),
}));

vi.mock("../infrastructure/signUpWithPasswordEmailNative", () => ({
  signUpWithPasswordEmailNative: (...args: unknown[]) => signUpWithPasswordEmailNative(...args),
}));

import {
  observeNativeAuthIdentity,
  ensureNativeAuthIdentitySettled,
  isNativeAuthIdentitySettled,
  signOutNativeAuthIdentity,
  signOutNativeAuthIdentityFromBoundClient,
  bindNativeAuthIdentityQueryClient,
  completeAndPublishNativeOAuth,
  completeAndPublishNativePasswordSignIn,
  completeAndPublishNativePasswordSignUp,
} from "./nativeAuthIdentityLifecycle";

const userA = { id: "user-a", email: "a@example.com" };
const userB = { id: "user-b", email: "b@example.com" };
const mappedUserB = { id: "user-b", email: "b@example.com", fullName: undefined };

function seed(qc: QueryClient) {
  qc.setQueryData(AUTH_USER_QUERY_KEY, userA);
  qc.setQueryData(["projects"] as QueryKey, [{ id: "p-a" }]);
}

beforeEach(() => {
  readNativeAuthSession.mockReset();
  signOutNativeSession.mockReset();
  completeNativeOAuthSignIn.mockReset();
  signInWithPasswordEmailNative.mockReset();
  signUpWithPasswordEmailNative.mockReset();
  signOutNativeSession.mockResolvedValue(undefined);
  completeNativeOAuthSignIn.mockResolvedValue({
    kind: "authenticated",
    user: userB,
    destination: "/dashboard",
  });
  signInWithPasswordEmailNative.mockResolvedValue({
    user: { id: "user-b", email: "b@example.com" },
    session: { access_token: "at" },
  });
  signUpWithPasswordEmailNative.mockResolvedValue({
    user: { id: "user-b", email: "b@example.com" },
    session: { access_token: "at" },
  });
  // Clear module-level bound QC so unbound tests are deterministic.
  const unbind = bindNativeAuthIdentityQueryClient(new QueryClient());
  unbind();
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

describe("shared per-QueryClient settlement", () => {
  it("concurrent ensure shares one read flight and settles once", async () => {
    const qc = new QueryClient();
    getAuthIdentityTransitionController(qc);
    let reads = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    readNativeAuthSession.mockImplementation(async () => {
      reads += 1;
      await gate;
      return { kind: "authenticated", user: userA };
    });

    const a = ensureNativeAuthIdentitySettled(qc);
    const b = ensureNativeAuthIdentitySettled(qc);
    expect(isNativeAuthIdentitySettled(qc)).toBe(false);
    release();
    await Promise.all([a, b]);
    expect(reads).toBe(1);
    expect(isNativeAuthIdentitySettled(qc)).toBe(true);
    expect(qc.getQueryData(AUTH_USER_QUERY_KEY)).toEqual(userA);
  });

  it("fresh indeterminate settles without publishing false null", async () => {
    const qc = new QueryClient();
    getAuthIdentityTransitionController(qc);
    readNativeAuthSession.mockResolvedValue({ kind: "indeterminate" });

    const outcome = await ensureNativeAuthIdentitySettled(qc);
    expect(outcome).toEqual({ kind: "indeterminate" });
    expect(isNativeAuthIdentitySettled(qc)).toBe(true);
    expect(qc.getQueryData(AUTH_USER_QUERY_KEY)).toBeUndefined();
  });

  it("rejected observation settles without false null commit", async () => {
    const qc = new QueryClient();
    seed(qc);
    getAuthIdentityTransitionController(qc);
    readNativeAuthSession.mockRejectedValue(new Error("boom"));

    await ensureNativeAuthIdentitySettled(qc);
    expect(isNativeAuthIdentitySettled(qc)).toBe(true);
    expect(qc.getQueryData(AUTH_USER_QUERY_KEY)).toEqual(userA);
    expect(qc.getQueryData(["projects"] as QueryKey)).toEqual([{ id: "p-a" }]);
  });
});

describe("unbound shell sign-out", () => {
  it("does not clear Keychain without bound transition authority", async () => {
    await expect(signOutNativeAuthIdentityFromBoundClient()).rejects.toThrow(
      /AuthProvider-bound QueryClient/,
    );
    expect(signOutNativeSession).not.toHaveBeenCalled();
  });

  it("bound client clears storage then A→null purge before null publish", async () => {
    const qc = new QueryClient();
    seed(qc);
    getAuthIdentityTransitionController(qc);
    const unbind = bindNativeAuthIdentityQueryClient(qc);

    const order: string[] = [];
    signOutNativeSession.mockImplementation(async () => {
      order.push("signOut");
    });
    const origCancel = qc.cancelQueries.bind(qc);
    vi.spyOn(qc, "cancelQueries").mockImplementation(async (...args) => {
      order.push("cancel");
      return origCancel(...args);
    });
    const origRemove = qc.removeQueries.bind(qc);
    vi.spyOn(qc, "removeQueries").mockImplementation((...args) => {
      order.push("remove");
      return origRemove(...args);
    });
    const origSet = qc.setQueryData.bind(qc);
    vi.spyOn(qc, "setQueryData").mockImplementation((key, value) => {
      if (Array.isArray(key) && key[0] === "auth") {
        order.push(`auth:${value === null ? "null" : "user"}`);
      }
      return origSet(key, value);
    });

    await signOutNativeAuthIdentityFromBoundClient();
    expect(order[0]).toBe("signOut");
    expect(order.indexOf("cancel")).toBeLessThan(order.indexOf("auth:null"));
    expect(order.indexOf("remove")).toBeLessThan(order.indexOf("auth:null"));
    expect(qc.getQueryData(AUTH_USER_QUERY_KEY)).toBeNull();
    expect(qc.getQueryData(["projects"] as QueryKey)).toBeUndefined();
    unbind();
  });
});

describe("completeAndPublishNativePasswordSignIn", () => {
  it("serializes native sign-in then AUTH publish with A→B purge", async () => {
    const qc = new QueryClient();
    seed(qc);
    getAuthIdentityTransitionController(qc);

    const order: string[] = [];
    signInWithPasswordEmailNative.mockImplementation(async () => {
      order.push("signIn");
      return {
        user: { id: "user-b", email: "b@example.com" },
        session: { access_token: "at" },
      };
    });
    const origSet = qc.setQueryData.bind(qc);
    vi.spyOn(qc, "setQueryData").mockImplementation((key, value) => {
      if (Array.isArray(key) && key[0] === "auth") {
        order.push(`auth:${(value as { id?: string } | null)?.id ?? "null"}`);
      }
      return origSet(key, value);
    });

    const result = await completeAndPublishNativePasswordSignIn(qc, {
      email: "b@example.com",
      password: "pw",
    });
    expect(result).toEqual({ user: mappedUserB });
    expect(signInWithPasswordEmailNative).toHaveBeenCalledWith({
      email: "b@example.com",
      password: "pw",
    });
    expect(order[0]).toBe("signIn");
    expect(order).toContain("auth:user-b");
    expect(qc.getQueryData(AUTH_USER_QUERY_KEY)).toEqual(mappedUserB);
    expect(qc.getQueryData(["projects"] as QueryKey)).toBeUndefined();
  });

  it("throws Auth errors without publishing authenticated state", async () => {
    const qc = new QueryClient();
    seed(qc);
    getAuthIdentityTransitionController(qc);
    const authError = Object.assign(new Error("Invalid login credentials"), { status: 400 });
    signInWithPasswordEmailNative.mockRejectedValue(authError);

    await expect(
      completeAndPublishNativePasswordSignIn(qc, { email: "a@b.com", password: "bad" }),
    ).rejects.toBe(authError);
    expect(qc.getQueryData(AUTH_USER_QUERY_KEY)).toEqual(userA);
    expect(qc.getQueryData(["projects"] as QueryKey)).toEqual([{ id: "p-a" }]);
  });

  it("does not publish when native sign-in returns no session", async () => {
    const qc = new QueryClient();
    seed(qc);
    getAuthIdentityTransitionController(qc);
    signInWithPasswordEmailNative.mockResolvedValue({
      user: { id: "user-b", email: "b@example.com" },
      session: null,
    });

    await expect(
      completeAndPublishNativePasswordSignIn(qc, { email: "b@example.com", password: "pw" }),
    ).rejects.toThrow("Sign-in failed.");
    expect(qc.getQueryData(AUTH_USER_QUERY_KEY)).toEqual(userA);
  });
});

describe("completeAndPublishNativePasswordSignUp", () => {
  it("session-present: applies transition after native signUp", async () => {
    const qc = new QueryClient();
    seed(qc);
    getAuthIdentityTransitionController(qc);

    const result = await completeAndPublishNativePasswordSignUp(qc, {
      email: "b@example.com",
      password: "secret12",
      fullName: "Ada",
      companyName: "Co",
    });

    expect(signUpWithPasswordEmailNative).toHaveBeenCalledWith({
      email: "b@example.com",
      password: "secret12",
      fullName: "Ada",
      companyName: "Co",
    });
    expect(result).toEqual({ kind: "session", user: mappedUserB });
    expect(qc.getQueryData(AUTH_USER_QUERY_KEY)).toEqual(mappedUserB);
    expect(qc.getQueryData(["projects"] as QueryKey)).toBeUndefined();
  });

  it("session-absent: does not applyTransition(user) or applyTransition(null)", async () => {
    const qc = new QueryClient();
    seed(qc);
    getAuthIdentityTransitionController(qc);
    signUpWithPasswordEmailNative.mockResolvedValue({
      user: { id: "user-b", email: "b@example.com" },
      session: null,
    });

    const result = await completeAndPublishNativePasswordSignUp(qc, {
      email: "verify@ex.com",
      password: "secret12",
    });

    expect(result).toEqual({ kind: "awaiting_verification", user: mappedUserB });
    expect(qc.getQueryData(AUTH_USER_QUERY_KEY)).toEqual(userA);
    expect(qc.getQueryData(["projects"] as QueryKey)).toEqual([{ id: "p-a" }]);
  });

  it("throws Auth errors without publishing", async () => {
    const qc = new QueryClient();
    seed(qc);
    getAuthIdentityTransitionController(qc);
    const authError = Object.assign(new Error("User already registered"), { status: 400 });
    signUpWithPasswordEmailNative.mockRejectedValue(authError);

    await expect(
      completeAndPublishNativePasswordSignUp(qc, { email: "a@b.com", password: "pw1234" }),
    ).rejects.toBe(authError);
    expect(qc.getQueryData(AUTH_USER_QUERY_KEY)).toEqual(userA);
  });
});
