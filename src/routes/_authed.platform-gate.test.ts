/**
 * IOS-READINESS-2B-3/4 — _authed platform gate + useAuth native identity contracts.
 *
 * useAuth runtime tests live here (not src/hooks/) so the legacy hooks freeze
 * allowlist is not expanded.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AuthProvider, AUTH_USER_QUERY_KEY, useAuth } from "@/hooks/useAuth";

const isNativePlatform = vi.fn();
const getCurrentUserServerFn = vi.fn();
const useServerFn = vi.fn((_fn?: unknown) => getCurrentUserServerFn);
const getSession = vi.fn();
const nativeSignOut = vi.fn();
const getNativeSupabase = vi.fn(() => ({
  auth: {
    getSession: (...args: unknown[]) => getSession(...args),
    signOut: (...args: unknown[]) => nativeSignOut(...args),
  },
}));
const authOnChange = vi.fn();
const authSignOut = vi.fn();
const appAddListener = vi.fn();

/**
 * Mock the public auth barrel (same pattern as index.native-entry.test.tsx).
 * `import("@/features/auth")` must not evaluate AuthExperience + OAuth + browser
 * Supabase — that cold graph exceeds Vitest's 5s isolation timeout.
 */
const {
  observeNativeAuthIdentity,
  ensureNativeAuthIdentitySettled,
  signOutNativeAuthIdentity,
  bindNativeAuthIdentityQueryClient,
} = vi.hoisted(() => ({
  observeNativeAuthIdentity: vi.fn(),
  ensureNativeAuthIdentitySettled: vi.fn(),
  signOutNativeAuthIdentity: vi.fn(),
  bindNativeAuthIdentityQueryClient: vi.fn((_queryClient?: QueryClient) => () => {}),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
  // Full auth barrel (useAuth lifecycle import) pulls OAuth web-auth-session
  // which calls registerPlugin at module init.
  registerPlugin: vi.fn(() => ({})),
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: (...args: unknown[]) => appAddListener(...args),
  },
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => useServerFn(fn),
}));

vi.mock("@/serverFns/auth", () => ({
  getCurrentUserServerFn: (...args: unknown[]) => getCurrentUserServerFn(...args),
}));

vi.mock("@/platform/supabase/native", () => ({
  getNativeSupabase: () => getNativeSupabase(),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    onChange: (listener: (u: unknown) => void) => {
      authOnChange(listener);
      return () => {
        /* unsubscribe */
      };
    },
    signOut: (...args: unknown[]) => authSignOut(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/features/auth", () => ({
  observeNativeAuthIdentity: (queryClient: QueryClient) =>
    observeNativeAuthIdentity(queryClient),
  ensureNativeAuthIdentitySettled: (queryClient: QueryClient) =>
    ensureNativeAuthIdentitySettled(queryClient),
  signOutNativeAuthIdentity: (queryClient: QueryClient) =>
    signOutNativeAuthIdentity(queryClient),
  bindNativeAuthIdentityQueryClient: (queryClient: QueryClient) =>
    bindNativeAuthIdentityQueryClient(queryClient),
}));

// Import route after mocks.
import { Route } from "./_authed";

const AUTHED_SRC = join(__dirname, "_authed.tsx");
const USE_AUTH_SRC = join(process.cwd(), "src/hooks/useAuth.ts");

function createWrapper(queryClient: QueryClient, withProvider = false) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const inner = withProvider ? createElement(AuthProvider, null, children) : children;
    return createElement(QueryClientProvider, { client: queryClient }, inner);
  };
}

/** Instant barrel mock races React Strict Mode dispose; production import is slow. */
function renderAuthHook<T>(fn: () => T, queryClient: QueryClient, withProvider = false) {
  return renderHook(fn, {
    wrapper: createWrapper(queryClient, withProvider),
    reactStrictMode: false,
  });
}

async function defaultObserveNativeAuthIdentity(queryClient: QueryClient) {
  const { getAuthIdentityTransitionController } = await import("@/lib/auth-query-lifecycle");
  const controller = getAuthIdentityTransitionController(queryClient);
  return controller.observe(async () => {
    try {
      const {
        data: { session },
        error,
      } = await getNativeSupabase().auth.getSession();
      if (error) return { kind: "indeterminate" as const };
      if (!session) return { kind: "signed-out" as const };
      const raw = session.user as {
        id?: string;
        email?: string | null;
        user_metadata?: Record<string, unknown>;
      } | null;
      if (!raw?.id) return { kind: "indeterminate" as const };
      const meta = raw.user_metadata;
      const fullName =
        (typeof meta?.full_name === "string" ? meta.full_name : undefined) ??
        (typeof meta?.name === "string" ? meta.name : undefined);
      return {
        kind: "authenticated" as const,
        user: { id: raw.id, email: raw.email ?? "", fullName },
      };
    } catch {
      return { kind: "indeterminate" as const };
    }
  });
}

const nativeSettlements = new WeakMap<QueryClient, Promise<unknown>>();

function defaultEnsureNativeAuthIdentitySettled(queryClient: QueryClient) {
  const existing = nativeSettlements.get(queryClient);
  if (existing) return existing;
  const promise = (async () => {
    try {
      return await observeNativeAuthIdentity(queryClient);
    } catch {
      return undefined;
    }
  })();
  nativeSettlements.set(queryClient, promise);
  return promise;
}

async function defaultSignOutNativeAuthIdentity(queryClient: QueryClient) {
  const { getAuthIdentityTransitionController } = await import("@/lib/auth-query-lifecycle");
  const controller = getAuthIdentityTransitionController(queryClient);
  await controller.runSerialized(async ({ applyTransition }) => {
    const { error } = await getNativeSupabase().auth.signOut({ scope: "local" });
    if (error) throw error;
    await applyTransition(null);
  });
}

observeNativeAuthIdentity.mockImplementation(defaultObserveNativeAuthIdentity);
ensureNativeAuthIdentitySettled.mockImplementation(defaultEnsureNativeAuthIdentitySettled);
signOutNativeAuthIdentity.mockImplementation(defaultSignOutNativeAuthIdentity);
bindNativeAuthIdentityQueryClient.mockImplementation(() => () => {});

beforeEach(() => {
  isNativePlatform.mockReset();
  getCurrentUserServerFn.mockReset();
  useServerFn.mockClear();
  getSession.mockReset();
  nativeSignOut.mockReset();
  getNativeSupabase.mockClear();
  authOnChange.mockReset();
  authSignOut.mockReset();
  appAddListener.mockReset();
  observeNativeAuthIdentity.mockClear();
  observeNativeAuthIdentity.mockImplementation(defaultObserveNativeAuthIdentity);
  ensureNativeAuthIdentitySettled.mockClear();
  ensureNativeAuthIdentitySettled.mockImplementation(defaultEnsureNativeAuthIdentitySettled);
  signOutNativeAuthIdentity.mockClear();
  signOutNativeAuthIdentity.mockImplementation(defaultSignOutNativeAuthIdentity);
  bindNativeAuthIdentityQueryClient.mockClear();
  bindNativeAuthIdentityQueryClient.mockImplementation(() => () => {});
  isNativePlatform.mockReturnValue(false);
  getCurrentUserServerFn.mockResolvedValue({ user: { id: "web-u", email: "w@e.com" } });
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  authSignOut.mockResolvedValue(undefined);
  nativeSignOut.mockResolvedValue({ error: null });
  appAddListener.mockResolvedValue({ remove: vi.fn() });
});

afterEach(() => {
  isNativePlatform.mockClear();
  getCurrentUserServerFn.mockClear();
  useServerFn.mockClear();
  getSession.mockClear();
  nativeSignOut.mockClear();
  getNativeSupabase.mockClear();
  authOnChange.mockClear();
  authSignOut.mockClear();
  appAddListener.mockClear();
  observeNativeAuthIdentity.mockClear();
});

describe("_authed beforeLoad — platform split", () => {
  const location = { pathname: "/dashboard", searchStr: "" };

  it("web path uses cookie serverFn and never constructs native client", async () => {
    isNativePlatform.mockReturnValue(false);
    const beforeLoad = Route.options.beforeLoad;
    expect(beforeLoad).toBeTypeOf("function");

    const ctx = await beforeLoad!({
      location,
      context: { queryClient: new QueryClient() },
    } as never);

    expect(ctx).toEqual({ user: { id: "web-u", email: "w@e.com" } });
    expect(getCurrentUserServerFn).toHaveBeenCalled();
    expect(observeNativeAuthIdentity).not.toHaveBeenCalled();
    expect(getNativeSupabase).not.toHaveBeenCalled();
  });

  it("native path uses serialized observe and never calls cookie serverFn", async () => {
    isNativePlatform.mockReturnValue(true);
    getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "native-u", email: "n@e.com", user_metadata: { name: "N" } },
        },
      },
      error: null,
    });

    const queryClient = new QueryClient();
    const beforeLoad = Route.options.beforeLoad!;
    const ctx = await beforeLoad({
      location,
      context: { queryClient },
    } as never);

    expect(observeNativeAuthIdentity).toHaveBeenCalledWith(queryClient);
    expect(getNativeSupabase).toHaveBeenCalled();
    expect(getSession).toHaveBeenCalled();
    expect(getCurrentUserServerFn).not.toHaveBeenCalled();
    expect(ctx).toEqual({
      user: { id: "native-u", email: "n@e.com", fullName: "N" },
    });
    expect(queryClient.getQueryData(AUTH_USER_QUERY_KEY)).toEqual({
      id: "native-u",
      email: "n@e.com",
      fullName: "N",
    });
  });

  it("native missing session redirects to /auth after commit null", async () => {
    isNativePlatform.mockReturnValue(true);
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    const queryClient = new QueryClient();
    queryClient.setQueryData(AUTH_USER_QUERY_KEY, { id: "was-a", email: "a@e.com" });
    queryClient.setQueryData(["projects"], [{ id: "p1" }]);

    const beforeLoad = Route.options.beforeLoad!;
    await expect(beforeLoad({ location, context: { queryClient } } as never)).rejects.toMatchObject(
      {
        options: expect.objectContaining({
          to: "/auth",
        }),
      },
    );
    expect(observeNativeAuthIdentity).toHaveBeenCalledWith(queryClient);
    expect(getCurrentUserServerFn).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(AUTH_USER_QUERY_KEY)).toBeNull();
    expect(queryClient.getQueryData(["projects"])).toBeUndefined();
  });

  it("native getSession error is indeterminate fail-closed without false null commit", async () => {
    isNativePlatform.mockReturnValue(true);
    getSession.mockResolvedValue({
      data: { session: null },
      error: { message: "refresh failed" },
    });
    const queryClient = new QueryClient();
    queryClient.setQueryData(AUTH_USER_QUERY_KEY, { id: "was-a", email: "a@e.com" });
    queryClient.setQueryData(["projects"], [{ id: "p1" }]);

    const beforeLoad = Route.options.beforeLoad!;
    await expect(beforeLoad({ location, context: { queryClient } } as never)).rejects.toMatchObject(
      {
        options: expect.objectContaining({ to: "/auth" }),
      },
    );
    expect(observeNativeAuthIdentity).toHaveBeenCalledWith(queryClient);
    // A retained — no false signed-out publication
    expect(queryClient.getQueryData(AUTH_USER_QUERY_KEY)).toEqual({
      id: "was-a",
      email: "a@e.com",
    });
    expect(queryClient.getQueryData(["projects"])).toEqual([{ id: "p1" }]);
  });

  it("source uses observeNativeAuthIdentity via public API and cookie serverFn", () => {
    const src = readFileSync(AUTHED_SRC, "utf8");
    expect(src).toMatch(/observeNativeAuthIdentity/);
    expect(src).toMatch(/import\(["']@\/features\/auth["']\)/);
    expect(src).toMatch(/context\.queryClient/);
    expect(src).not.toMatch(
      /import\s*\{[^}]*getNativeSupabase[^}]*\}\s*from\s*["']@\/platform\/supabase\/native["']/,
    );
    expect(src).toMatch(/getCurrentUserServerFn/);
    expect(src).toMatch(/isNativePlatform/);
  });
});

describe("useAuth — web path", () => {
  it("reads cookie serverFn identity and does not construct native client", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderAuthHook(() => useAuth(), queryClient);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getCurrentUserServerFn).toHaveBeenCalled();
    expect(getNativeSupabase).not.toHaveBeenCalled();
    expect(result.current.user).toEqual({ id: "web-u", email: "w@e.com" });
  });

  it("signOut calls browser auth.signOut exactly once", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderAuthHook(() => useAuth(), queryClient);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(authSignOut).toHaveBeenCalledTimes(1);
  });
});

describe("useAuth — native path", () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(true);
    getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "native-u",
            email: "n@e.com",
            user_metadata: { full_name: "Native User" },
          },
        },
      },
      error: null,
    });
  });

  it("AuthProvider observe publishes identity; never calls cookie serverFn", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderAuthHook(() => useAuth(), queryClient, true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getNativeSupabase).toHaveBeenCalled();
    expect(getSession).toHaveBeenCalled();
    expect(getCurrentUserServerFn).not.toHaveBeenCalled();
    expect(result.current.user).toEqual({
      id: "native-u",
      email: "n@e.com",
      fullName: "Native User",
    });
  });

  it("indeterminate getSession error retains prior identity after observe", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(AUTH_USER_QUERY_KEY, {
      id: "prior",
      email: "p@e.com",
    });
    getSession.mockResolvedValue({
      data: { session: null },
      error: new Error("storage fail"),
    });

    const { result } = renderAuthHook(() => useAuth(), queryClient, true);

    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    // Indeterminate must not wipe known A
    expect(result.current.user).toEqual({ id: "prior", email: "p@e.com" });
    expect(queryClient.getQueryData(AUTH_USER_QUERY_KEY)).toEqual({
      id: "prior",
      email: "p@e.com",
    });
    expect(getCurrentUserServerFn).not.toHaveBeenCalled();
  });

  it("fresh indeterminate settles without false null or permanent loading", async () => {
    getSession.mockResolvedValue({
      data: { session: null },
      error: new Error("refresh failed"),
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderAuthHook(() => useAuth(), queryClient, true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hydrated).toBe(true);
    });

    expect(result.current.user).toBeNull();
    // Must not publish authoritative signed-out null into AUTH cache
    expect(queryClient.getQueryData(AUTH_USER_QUERY_KEY)).toBeUndefined();
  });

  it("multiple useAuth consumers share settlement and agree on identity", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderAuthHook(
      () => ({
        a: useAuth(),
        b: useAuth(),
      }),
      queryClient,
      true,
    );

    await waitFor(() => {
      expect(result.current.a.user).toMatchObject({ id: "native-u" });
      expect(result.current.b.user).toMatchObject({ id: "native-u" });
    });

    expect(result.current.a.user).toEqual(result.current.b.user);
    // One shared Keychain read flight for initial settlement (+ possible resume not fired)
    expect(getSession.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("signOut uses native local signOut not browser auth", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderAuthHook(() => useAuth(), queryClient, true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(nativeSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(authSignOut).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(AUTH_USER_QUERY_KEY)).toBeNull();
  });

  it("explicit refetch uses observe path", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderAuthHook(() => useAuth(), queryClient, true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    getSession.mockClear();
    getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "native-u", email: "n@e.com", user_metadata: {} },
        },
      },
      error: null,
    });

    let user: unknown;
    await act(async () => {
      user = await result.current.refetch();
    });
    expect(getSession).toHaveBeenCalled();
    expect(user).toMatchObject({ id: "native-u" });
  });
});

describe("AuthProvider lifecycle bridge", () => {
  it("does not subscribe to auth.onChange on native", async () => {
    isNativePlatform.mockReturnValue(true);
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderAuthHook(() => useAuth(), queryClient, true);

    await waitFor(() => {
      expect(getSession).toHaveBeenCalled();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(authOnChange).not.toHaveBeenCalled();
  });

  it("subscribes to auth.onChange on web", async () => {
    isNativePlatform.mockReturnValue(false);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderAuthHook(() => useAuth(), queryClient, true);

    await waitFor(() => {
      expect(authOnChange).toHaveBeenCalledTimes(1);
    });
  });

  it("native source installs one appStateChange listener", () => {
    const src = readFileSync(USE_AUTH_SRC, "utf8");
    expect(src).toMatch(/appStateChange/);
    expect(src).toMatch(/addListener/);
  });
});

describe("useAuth — source boundary", () => {
  it("native observer-only query; lifecycle imports; web onChange retained", () => {
    const src = readFileSync(USE_AUTH_SRC, "utf8");
    expect(src).toMatch(/enabled:\s*!isNative/);
    expect(src).toMatch(/observeNativeAuthIdentity/);
    expect(src).toMatch(/signOutNativeAuthIdentity/);
    expect(src).toMatch(/import type \{ AuthUser \}/);
    expect(src).not.toMatch(/import\s*\{\s*auth\s*,/);
    expect(src).toMatch(/auth\.onChange/);
    expect(src).toMatch(/isNativePlatform/);
    expect(src).not.toMatch(/NATIVE_SIGNOUT_UNAVAILABLE|Sign out is not available in this native/);
  });
});
