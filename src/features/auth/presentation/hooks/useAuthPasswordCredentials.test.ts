/**
 * AO-1E1.1 / NATIVE-AUTH-PASSWORD-1 — password credential presentation hook contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const setQueryData = vi.fn();
const queryClient = { setQueryData };
const signInWithPasswordEmail = vi.fn();
const signUpWithPasswordEmail = vi.fn();
const completeAndPublishNativePasswordSignIn = vi.fn();
const completeAndPublishNativePasswordSignUp = vi.fn();
const markNewUserOnboarding = vi.fn();
const trackEvent = vi.fn();
const trackSignupCompleted = vi.fn();
const isNativePlatform = vi.fn();
const fromSupabaseUser = vi.fn((u: unknown) => {
  if (u && typeof u === "object" && "id" in u) {
    const user = u as { id: string; email?: string };
    return { id: user.id, email: user.email ?? "" };
  }
  return null;
});

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => queryClient,
}));

vi.mock("@/lib/auth", () => ({
  fromSupabaseUser: (u: unknown) => fromSupabaseUser(u),
}));

vi.mock("@/hooks/useAuth", () => ({
  AUTH_USER_QUERY_KEY: ["auth", "currentUser"],
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: (name: unknown, props?: unknown) => trackEvent(name, props),
  trackSignupCompleted: (provider: unknown, id?: unknown) => trackSignupCompleted(provider, id),
}));

vi.mock("../../onboardingStorage", () => ({
  markNewUserOnboarding: () => markNewUserOnboarding(),
}));

vi.mock("../../infrastructure/signInWithPasswordEmail", () => ({
  signInWithPasswordEmail: (input: unknown) => signInWithPasswordEmail(input),
}));

vi.mock("../../infrastructure/signUpWithPasswordEmail", () => ({
  signUpWithPasswordEmail: (input: unknown) => signUpWithPasswordEmail(input),
}));

vi.mock("../nativeAuthIdentityLifecycle", () => ({
  completeAndPublishNativePasswordSignIn: (...args: unknown[]) =>
    completeAndPublishNativePasswordSignIn(...args),
  completeAndPublishNativePasswordSignUp: (...args: unknown[]) =>
    completeAndPublishNativePasswordSignUp(...args),
}));

import { useAuthPasswordCredentials } from "./useAuthPasswordCredentials";

const SRC = join(__dirname, "useAuthPasswordCredentials.ts");

beforeEach(() => {
  setQueryData.mockReset();
  signInWithPasswordEmail.mockReset();
  signUpWithPasswordEmail.mockReset();
  completeAndPublishNativePasswordSignIn.mockReset();
  completeAndPublishNativePasswordSignUp.mockReset();
  markNewUserOnboarding.mockReset();
  trackEvent.mockReset();
  trackSignupCompleted.mockReset();
  fromSupabaseUser.mockClear();
  isNativePlatform.mockReset();
  isNativePlatform.mockReturnValue(false);
  completeAndPublishNativePasswordSignIn.mockResolvedValue({
    user: { id: "n1", email: "n@e.com" },
  });
  completeAndPublishNativePasswordSignUp.mockResolvedValue({
    kind: "session",
    user: { id: "n2", email: "n2@e.com" },
  });
});

describe("useAuthPasswordCredentials — web sign-in", () => {
  it("seeds AUTH_USER_QUERY_KEY and product sign-in event without direct identify", async () => {
    const user = { id: "u1", email: "a@b.com" };
    signInWithPasswordEmail.mockResolvedValue({ user });

    const { result } = renderHook(() => useAuthPasswordCredentials());

    await act(async () => {
      await result.current.signInWithPassword("a@b.com", "pw");
    });

    expect(signInWithPasswordEmail).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "pw",
    });
    expect(completeAndPublishNativePasswordSignIn).not.toHaveBeenCalled();
    expect(setQueryData).toHaveBeenCalledWith(["auth", "currentUser"], {
      id: "u1",
      email: "a@b.com",
    });
    expect(trackEvent).toHaveBeenCalledWith("user_signed_in", { provider: "email" });
    expect(markNewUserOnboarding).not.toHaveBeenCalled();
  });

  it("propagates thrown Auth errors without seeding cache", async () => {
    signInWithPasswordEmail.mockRejectedValue(new Error("Invalid login credentials"));
    const { result } = renderHook(() => useAuthPasswordCredentials());

    await expect(
      act(async () => {
        await result.current.signInWithPassword("a@b.com", "bad");
      }),
    ).rejects.toThrow("Invalid login credentials");

    expect(setQueryData).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(completeAndPublishNativePasswordSignIn).not.toHaveBeenCalled();
  });
});

describe("useAuthPasswordCredentials — native sign-in", () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(true);
  });

  it("publishes through the native lifecycle helper and never uses browser authority", async () => {
    const { result } = renderHook(() => useAuthPasswordCredentials());

    await act(async () => {
      await result.current.signInWithPassword("a@b.com", "pw");
    });

    expect(completeAndPublishNativePasswordSignIn).toHaveBeenCalledTimes(1);
    expect(completeAndPublishNativePasswordSignIn).toHaveBeenCalledWith(queryClient, {
      email: "a@b.com",
      password: "pw",
    });
    expect(signInWithPasswordEmail).not.toHaveBeenCalled();
    expect(setQueryData).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith("user_signed_in", { provider: "email" });
  });

  it("propagates native Auth errors without cache write or success analytics", async () => {
    completeAndPublishNativePasswordSignIn.mockRejectedValue(
      new Error("Invalid login credentials"),
    );
    const { result } = renderHook(() => useAuthPasswordCredentials());

    await expect(
      act(async () => {
        await result.current.signInWithPassword("a@b.com", "bad");
      }),
    ).rejects.toThrow("Invalid login credentials");

    expect(signInWithPasswordEmail).not.toHaveBeenCalled();
    expect(setQueryData).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});

describe("useAuthPasswordCredentials — web signup", () => {
  it("session-present: signup event, mark onboarding, seed cache, returns session", async () => {
    const user = { id: "u2", email: "new@ex.com" };
    const session = { access_token: "t" };
    signUpWithPasswordEmail.mockResolvedValue({ user, session });

    const { result } = renderHook(() => useAuthPasswordCredentials());

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.signUpWithPassword({
        email: "new@ex.com",
        password: "secret12",
        fullName: "Ada",
        companyName: "Co",
      });
    });

    expect(signUpWithPasswordEmail).toHaveBeenCalledWith({
      email: "new@ex.com",
      password: "secret12",
      fullName: "Ada",
      companyName: "Co",
    });
    expect(completeAndPublishNativePasswordSignUp).not.toHaveBeenCalled();
    expect(trackSignupCompleted).toHaveBeenCalledWith("email", "u2");
    expect(markNewUserOnboarding).toHaveBeenCalledTimes(1);
    expect(setQueryData).toHaveBeenCalledWith(["auth", "currentUser"], {
      id: "u2",
      email: "new@ex.com",
    });
    expect(outcome).toBe("session");
  });

  it("session-absent: signup event only, no onboarding flag or cache seed", async () => {
    const user = { id: "u3", email: "verify@ex.com" };
    signUpWithPasswordEmail.mockResolvedValue({ user, session: null });

    const { result } = renderHook(() => useAuthPasswordCredentials());

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.signUpWithPassword({
        email: "verify@ex.com",
        password: "secret12",
      });
    });

    expect(trackSignupCompleted).toHaveBeenCalledWith("email", "u3");
    expect(markNewUserOnboarding).not.toHaveBeenCalled();
    expect(setQueryData).not.toHaveBeenCalled();
    expect(completeAndPublishNativePasswordSignUp).not.toHaveBeenCalled();
    expect(outcome).toBe("awaiting_verification");
  });

  it("propagates thrown signup errors without side effects", async () => {
    signUpWithPasswordEmail.mockRejectedValue(new Error("User already registered"));
    const { result } = renderHook(() => useAuthPasswordCredentials());

    await expect(
      act(async () => {
        await result.current.signUpWithPassword({
          email: "a@b.com",
          password: "pw1234",
        });
      }),
    ).rejects.toThrow("User already registered");

    expect(markNewUserOnboarding).not.toHaveBeenCalled();
    expect(setQueryData).not.toHaveBeenCalled();
    expect(trackSignupCompleted).not.toHaveBeenCalled();
  });
});

describe("useAuthPasswordCredentials — native signup", () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(true);
  });

  it("session-present: publishes via lifecycle, marks onboarding, no browser/cache write", async () => {
    completeAndPublishNativePasswordSignUp.mockResolvedValue({
      kind: "session",
      user: { id: "n2", email: "n2@e.com" },
    });
    const { result } = renderHook(() => useAuthPasswordCredentials());

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.signUpWithPassword({
        email: "new@ex.com",
        password: "secret12",
        fullName: "Ada",
        companyName: "Co",
      });
    });

    expect(completeAndPublishNativePasswordSignUp).toHaveBeenCalledWith(queryClient, {
      email: "new@ex.com",
      password: "secret12",
      fullName: "Ada",
      companyName: "Co",
    });
    expect(signUpWithPasswordEmail).not.toHaveBeenCalled();
    expect(setQueryData).not.toHaveBeenCalled();
    expect(trackSignupCompleted).toHaveBeenCalledWith("email", "n2");
    expect(markNewUserOnboarding).toHaveBeenCalledTimes(1);
    expect(outcome).toBe("session");
  });

  it("session-absent: tracks signup, no onboarding, no AUTH write", async () => {
    completeAndPublishNativePasswordSignUp.mockResolvedValue({
      kind: "awaiting_verification",
      user: { id: "n3", email: "verify@ex.com" },
    });
    const { result } = renderHook(() => useAuthPasswordCredentials());

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.signUpWithPassword({
        email: "verify@ex.com",
        password: "secret12",
      });
    });

    expect(signUpWithPasswordEmail).not.toHaveBeenCalled();
    expect(setQueryData).not.toHaveBeenCalled();
    expect(markNewUserOnboarding).not.toHaveBeenCalled();
    expect(trackSignupCompleted).toHaveBeenCalledWith("email", "n3");
    expect(outcome).toBe("awaiting_verification");
  });
});

describe("useAuthPasswordCredentials — source boundary", () => {
  it("does not navigate, toast, or call platform supabase", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/@\/platform\/supabase/);
    expect(src).not.toMatch(/getNativeSupabase/);
    expect(src).not.toMatch(/\btoast\b|\blogger\b/);
    expect(src).not.toMatch(/useNavigate|navigate\s*\(/);
    expect(src).not.toMatch(/supabase\.auth/);
    expect(src).toMatch(/signInWithPasswordEmail/);
    expect(src).toMatch(/signUpWithPasswordEmail/);
    expect(src).toMatch(/completeAndPublishNativePasswordSignIn/);
    expect(src).toMatch(/completeAndPublishNativePasswordSignUp/);
    expect(src).toMatch(/isNativePlatform/);
    expect(src).toMatch(/setQueryData/);
    expect(src).toMatch(/markNewUserOnboarding/);
  });
});
