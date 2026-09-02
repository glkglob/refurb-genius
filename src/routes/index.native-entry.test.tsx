/**
 * IOS-DESIGN-COMPLETION — native `/` entry uses existing identity observer.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const isNativePlatform = vi.fn();
const observeNativeAuthIdentity = vi.fn();

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("@/features/auth", () => ({
  observeNativeAuthIdentity: (...args: unknown[]) => observeNativeAuthIdentity(...args),
}));

import { Route } from "./index";

const SRC = readFileSync(join(__dirname, "index.tsx"), "utf8");

describe("native `/` entry", () => {
  beforeEach(() => {
    isNativePlatform.mockReset();
    observeNativeAuthIdentity.mockReset();
  });

  it("source uses observeNativeAuthIdentity via public API and context.queryClient", () => {
    expect(SRC).toMatch(/observeNativeAuthIdentity/);
    expect(SRC).toMatch(/import\(["']@\/features\/auth["']\)/);
    expect(SRC).toMatch(/context\.queryClient/);
    expect(SRC).not.toMatch(/getNativeSupabase|getSession\(|localStorage|sessionStorage/);
  });

  it("web path does not observe native identity or redirect", async () => {
    isNativePlatform.mockReturnValue(false);
    const beforeLoad = Route.options.beforeLoad;
    expect(beforeLoad).toBeTypeOf("function");
    const result = await beforeLoad!({
      context: { queryClient: new QueryClient() },
    } as never);
    expect(result).toBeUndefined();
    expect(observeNativeAuthIdentity).not.toHaveBeenCalled();
  });

  it("native authenticated redirects to /dashboard", async () => {
    isNativePlatform.mockReturnValue(true);
    observeNativeAuthIdentity.mockResolvedValue({
      kind: "authenticated",
      user: { id: "u1", email: "a@b.com" },
    });
    const queryClient = new QueryClient();
    await expect(
      Route.options.beforeLoad!({ context: { queryClient } } as never),
    ).rejects.toMatchObject({
      options: expect.objectContaining({ to: "/dashboard" }),
    });
    expect(observeNativeAuthIdentity).toHaveBeenCalledWith(queryClient);
  });

  it("native signed-out redirects to /auth", async () => {
    isNativePlatform.mockReturnValue(true);
    observeNativeAuthIdentity.mockResolvedValue({ kind: "signed-out" });
    await expect(
      Route.options.beforeLoad!({ context: { queryClient: new QueryClient() } } as never),
    ).rejects.toMatchObject({
      options: expect.objectContaining({ to: "/auth" }),
    });
  });

  it("native indeterminate fail-closes to /auth without extra session writes", async () => {
    isNativePlatform.mockReturnValue(true);
    observeNativeAuthIdentity.mockResolvedValue({ kind: "indeterminate" });
    const queryClient = new QueryClient();
    queryClient.setQueryData(["auth", "currentUser"], { id: "was-a" });
    await expect(
      Route.options.beforeLoad!({ context: { queryClient } } as never),
    ).rejects.toMatchObject({
      options: expect.objectContaining({ to: "/auth" }),
    });
    expect(queryClient.getQueryData(["auth", "currentUser"])).toEqual({ id: "was-a" });
  });

  it("observer error fail-closes to /auth", async () => {
    isNativePlatform.mockReturnValue(true);
    observeNativeAuthIdentity.mockRejectedValue(new Error("observe failed"));
    await expect(
      Route.options.beforeLoad!({ context: { queryClient: new QueryClient() } } as never),
    ).rejects.toMatchObject({
      options: expect.objectContaining({ to: "/auth" }),
    });
  });
});
