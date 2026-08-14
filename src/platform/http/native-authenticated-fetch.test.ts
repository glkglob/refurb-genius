import { describe, it, expect, vi, beforeEach } from "vitest";

const isNativePlatform = vi.fn(() => true);
const tryGetNativeAccessToken = vi.fn();

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("./native-access-token", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./native-access-token")>();
  return {
    ...actual,
    tryGetNativeAccessToken: (...args: unknown[]) => tryGetNativeAccessToken(...args),
  };
});

describe("nativeAuthenticatedFetch", () => {
  beforeEach(() => {
    vi.resetModules();
    isNativePlatform.mockReturnValue(true);
    tryGetNativeAccessToken.mockReset();
  });

  it("builds HTTPS URL, attaches Bearer, and omits token from URL", async () => {
    tryGetNativeAccessToken.mockResolvedValue({ ok: true, accessToken: "tok-abc" });
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const { nativeAuthenticatedFetch } = await import("./native-authenticated-fetch");
    await nativeAuthenticatedFetch("/api/mobile/v1/session/ping", {
      method: "POST",
      json: {},
      origin: "https://www.refurbgenius.info",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const [url, init] = call;
    expect(url).toBe("https://www.refurbgenius.info/api/mobile/v1/session/ping");
    expect(url).not.toMatch(/tok-abc|access_token|Bearer/);
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer tok-abc");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Accept")).toBe("application/json");
  });

  it("classifies network failure without leaking token", async () => {
    tryGetNativeAccessToken.mockResolvedValue({ ok: true, accessToken: "tok-secret" });
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });

    const { nativeAuthenticatedFetch } = await import("./native-authenticated-fetch");
    await expect(
      nativeAuthenticatedFetch("/api/mobile/v1/session/ping", {
        method: "POST",
        origin: "https://www.refurbgenius.info",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "network", name: "NativeHttpError" });

    try {
      await nativeAuthenticatedFetch("/api/mobile/v1/session/ping", {
        method: "POST",
        origin: "https://www.refurbgenius.info",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
    } catch (e) {
      expect(String(e)).not.toContain("tok-secret");
    }
  });

  it("on 401 refreshes once and retries once only", async () => {
    tryGetNativeAccessToken
      .mockResolvedValueOnce({ ok: true, accessToken: "tok-1" })
      .mockResolvedValueOnce({ ok: true, accessToken: "tok-2" });

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("nope", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ authenticated: true }), { status: 200 }),
      );

    const { nativeAuthenticatedFetch } = await import("./native-authenticated-fetch");
    const res = await nativeAuthenticatedFetch("/api/mobile/v1/session/ping", {
      method: "POST",
      origin: "https://www.refurbgenius.info",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(tryGetNativeAccessToken).toHaveBeenCalledTimes(2);
    expect(tryGetNativeAccessToken.mock.calls[1]?.[0]).toEqual({ forceRefresh: true });

    const secondCall = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
    const secondHeaders = new Headers(secondCall[1].headers);
    expect(secondHeaders.get("Authorization")).toBe("Bearer tok-2");
  });

  it("fails closed after 401 refresh failure without further loop", async () => {
    tryGetNativeAccessToken
      .mockResolvedValueOnce({ ok: true, accessToken: "tok-1" })
      .mockResolvedValueOnce({ ok: false, reason: "refresh_failed" });

    const fetchImpl = vi.fn(async () => new Response("nope", { status: 401 }));

    const { nativeAuthenticatedFetch } = await import("./native-authenticated-fetch");
    await expect(
      nativeAuthenticatedFetch("/api/mobile/v1/session/ping", {
        method: "POST",
        origin: "https://www.refurbgenius.info",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ name: "NativeHttpError", code: "refresh_failed" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(tryGetNativeAccessToken).toHaveBeenCalledTimes(2);
  });

  it("does not retry more than once when second response is still 401", async () => {
    tryGetNativeAccessToken
      .mockResolvedValueOnce({ ok: true, accessToken: "tok-1" })
      .mockResolvedValueOnce({ ok: true, accessToken: "tok-2" });

    const fetchImpl = vi.fn(async () => new Response("nope", { status: 401 }));

    const { nativeAuthenticatedFetch } = await import("./native-authenticated-fetch");
    const res = await nativeAuthenticatedFetch("/api/mobile/v1/session/ping", {
      method: "POST",
      origin: "https://www.refurbgenius.info",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(res.status).toBe(401);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(tryGetNativeAccessToken).toHaveBeenCalledTimes(2);
  });

  it("nativeAuthenticatedJson surfaces JSON error without leaking tokens", async () => {
    tryGetNativeAccessToken.mockResolvedValue({ ok: true, accessToken: "tok-secret" });
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in 9s." }), {
          status: 429,
        }),
    );
    const { nativeAuthenticatedJson } = await import("./native-authenticated-fetch");
    await expect(
      nativeAuthenticatedJson("/api/mobile/v1/redesign/generate", {
        method: "POST",
        json: { projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" },
        origin: "https://www.refurbgenius.info",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({
      status: 429,
      message: "Rate limit exceeded. Try again in 9s.",
    });
  });

  it("rejects non-native platform", async () => {
    isNativePlatform.mockReturnValue(false);
    const { nativeAuthenticatedFetch } = await import("./native-authenticated-fetch");
    await expect(
      nativeAuthenticatedFetch("/api/mobile/v1/session/ping", {
        origin: "https://www.refurbgenius.info",
      }),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });
});
