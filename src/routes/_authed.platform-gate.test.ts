/**
 * IOS-READINESS-2B-3 — _authed platform gate + useAuth native identity contracts.
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
import {
  AuthProvider,
  AUTH_USER_QUERY_KEY,
  NATIVE_SIGNOUT_UNAVAILABLE_MESSAGE,
  useAuth,
} from "@/hooks/useAuth";

const isNativePlatform = vi.fn();
const getCurrentUserServerFn = vi.fn();
const useServerFn = vi.fn((_fn?: unknown) => getCurrentUserServerFn);
const getSession = vi.fn();
const getNativeSupabase = vi.fn(() => ({
  auth: { getSession: (...args: unknown[]) => getSession(...args) },
}));
const authOnChange = vi.fn();
const authSignOut = vi.fn();

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
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

beforeEach(() => {
  isNativePlatform.mockReset();
  getCurrentUserServerFn.mockReset();
  useServerFn.mockClear();
  getSession.mockReset();
  getNativeSupabase.mockClear();
  authOnChange.mockReset();
  authSignOut.mockReset();
  isNativePlatform.mockReturnValue(false);
  getCurrentUserServerFn.mockResolvedValue({ user: { id: "web-u", email: "w@e.com" } });
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  authSignOut.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("_authed beforeLoad — platform split", () => {
  const location = { pathname: "/dashboard", searchStr: "" };

  it("web path uses cookie serverFn and never constructs native client", async () => {
    isNativePlatform.mockReturnValue(false);
    const beforeLoad = Route.options.beforeLoad;
    expect(beforeLoad).toBeTypeOf("function");

    const ctx = await beforeLoad!({ location } as never);

    expect(ctx).toEqual({ user: { id: "web-u", email: "w@e.com" } });
    expect(getCurrentUserServerFn).toHaveBeenCalled();
    expect(getNativeSupabase).not.toHaveBeenCalled();
  });

  it("native path uses getNativeSupabase session and never calls cookie serverFn", async () => {
    isNativePlatform.mockReturnValue(true);
    getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "native-u", email: "n@e.com", user_metadata: { name: "N" } },
        },
      },
      error: null,
    });

    const beforeLoad = Route.options.beforeLoad!;
    const ctx = await beforeLoad({ location } as never);

    expect(getNativeSupabase).toHaveBeenCalled();
    expect(getSession).toHaveBeenCalled();
    expect(getCurrentUserServerFn).not.toHaveBeenCalled();
    expect(ctx).toEqual({
      user: { id: "native-u", email: "n@e.com", fullName: "N" },
    });
  });

  it("native missing session redirects to /auth", async () => {
    isNativePlatform.mockReturnValue(true);
    getSession.mockResolvedValue({ data: { session: null }, error: null });

    const beforeLoad = Route.options.beforeLoad!;
    await expect(beforeLoad({ location } as never)).rejects.toMatchObject({
      options: expect.objectContaining({
        to: "/auth",
      }),
    });
    expect(getCurrentUserServerFn).not.toHaveBeenCalled();
  });

  it("source does not statically import getNativeSupabase", () => {
    const src = readFileSync(AUTHED_SRC, "utf8");
    expect(src).toMatch(/import\(["']@\/platform\/supabase\/native["']\)/);
    expect(src).not.toMatch(
      /import\s*\{[^}]*getNativeSupabase[^}]*\}\s*from\s*["']@\/platform\/supabase\/native["']/,
    );
    expect(src).toMatch(/mapNativeSupabaseUser/);
    expect(src).toMatch(/getCurrentUserServerFn/);
    expect(src).toMatch(/isNativePlatform/);
    expect(src).toMatch(/@\/features\/auth\/infrastructure/);
  });
});

describe("useAuth — web path", () => {
  it("reads cookie serverFn identity and does not construct native client", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(queryClient),
    });

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
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(queryClient),
    });

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

  it("reads getNativeSupabase session and never calls cookie serverFn", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(queryClient),
    });

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

  it("returns null on getSession error", async () => {
    getSession.mockResolvedValue({
      data: { session: null },
      error: new Error("storage fail"),
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(getCurrentUserServerFn).not.toHaveBeenCalled();
  });

  it("signOut rejects without loading browser auth.signOut", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(
      act(async () => {
        await result.current.signOut();
      }),
    ).rejects.toThrow(NATIVE_SIGNOUT_UNAVAILABLE_MESSAGE);
    expect(authSignOut).not.toHaveBeenCalled();
  });
});

describe("AuthProvider lifecycle bridge", () => {
  it("does not subscribe to auth.onChange on native", async () => {
    isNativePlatform.mockReturnValue(true);
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderHook(() => useAuth(), {
      wrapper: createWrapper(queryClient, true),
    });

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

    renderHook(() => useAuth(), {
      wrapper: createWrapper(queryClient, true),
    });

    await waitFor(() => {
      expect(authOnChange).toHaveBeenCalledTimes(1);
    });
  });

  it("native has no browser lifecycle subscriber (seed cannot be browser-null-overwritten)", async () => {
    isNativePlatform.mockReturnValue(true);
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(AUTH_USER_QUERY_KEY, { id: "seeded", email: "s@e.com" });

    renderHook(() => useAuth(), {
      wrapper: createWrapper(queryClient, true),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(authOnChange).not.toHaveBeenCalled();
  });
});

describe("useAuth — source boundary", () => {
  it("lazy-loads native supabase; no static getNativeSupabase; type-only AuthUser", () => {
    const src = readFileSync(USE_AUTH_SRC, "utf8");
    expect(src).toMatch(/import\(["']@\/platform\/supabase\/native["']\)/);
    expect(src).not.toMatch(
      /import\s*\{[^}]*getNativeSupabase[^}]*\}\s*from\s*["']@\/platform\/supabase\/native["']/,
    );
    expect(src).toMatch(/import type \{ AuthUser \}/);
    expect(src).not.toMatch(/import\s*\{\s*auth\s*,/);
    expect(src).toMatch(/auth\.onChange/);
    expect(src).toMatch(/isNativePlatform/);
    expect(src).toMatch(/NATIVE_SIGNOUT_UNAVAILABLE_MESSAGE|Sign out is not available/);
    expect(src).toMatch(/@\/features\/auth\/infrastructure/);
  });
});
