/**
 * PH-SENTRY-1D1 / 1D1-R1 — Replay privacy pure helpers + auth-safe bootstrap.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_CALLBACK_PATH,
  __peekAuthCallbackBootstrapStateForTests,
  buildExplicitReplayPrivacyOptions,
  clearAuthCallbackBootstrapCapture,
  consumeAuthCallbackBootstrapCapture,
  extractAuthCallbackBootstrapFromHref,
  isAuthCallbackPath,
  prepareAuthCallbackLocationForReplay,
  sanitizeAuthCallbackHref,
  scrubReplayRecordingEvent,
  scrubUrlForReplay,
  storeAuthCallbackBootstrapCapture,
  stripSensitiveAuthCallbackLocation,
  takeAuthCallbackBootstrapCapture,
} from "./replay-privacy";

afterEach(() => {
  clearAuthCallbackBootstrapCapture();
});

describe("isAuthCallbackPath", () => {
  it("matches /auth/callback with optional trailing slash", () => {
    expect(isAuthCallbackPath("/auth/callback")).toBe(true);
    expect(isAuthCallbackPath("/auth/callback/")).toBe(true);
    expect(isAuthCallbackPath("/auth")).toBe(false);
    expect(isAuthCallbackPath("/projects/x")).toBe(false);
  });
});

describe("buildExplicitReplayPrivacyOptions", () => {
  it("pins mask/block/media and empty network-detail posture", () => {
    const opts = buildExplicitReplayPrivacyOptions();
    expect(opts.maskAllText).toBe(true);
    expect(opts.maskAllInputs).toBe(true);
    expect(opts.blockAllMedia).toBe(true);
    expect(opts.networkDetailAllowUrls).toEqual([]);
    expect(opts.networkDetailDenyUrls).toEqual([]);
    expect(opts.networkCaptureBodies).toBe(false);
    expect(typeof opts.beforeAddRecordingEvent).toBe("function");
  });

  it("does not unmask text/inputs or unblock media", () => {
    const opts = buildExplicitReplayPrivacyOptions();
    expect("unmask" in opts).toBe(false);
    expect("unblock" in opts).toBe(false);
    expect(opts.maskAllText).toBe(true);
    expect(opts.maskAllInputs).toBe(true);
    expect(opts.blockAllMedia).toBe(true);
  });
});

describe("sanitizeAuthCallbackHref", () => {
  const origin = "https://www.refurbgenius.info";

  it("strips synthetic code and token_hash from query", () => {
    const input = `${origin}${AUTH_CALLBACK_PATH}?code=SYNTHETIC_CODE&token_hash=SYNTHETIC_HASH&type=email&flow=magiclink&redirect_to=%2Fprojects`;
    const out = sanitizeAuthCallbackHref(input);
    expect(out).not.toMatch(/SYNTHETIC_CODE/);
    expect(out).not.toMatch(/SYNTHETIC_HASH/);
    expect(out).not.toMatch(/[?&]code=/);
    expect(out).not.toMatch(/token_hash=/);
    expect(out).toMatch(/type=email/);
    expect(out).toMatch(/flow=magiclink/);
    expect(out).toMatch(/redirect_to=/);
  });

  it("strips synthetic access_token from hash by default", () => {
    const input = `${origin}${AUTH_CALLBACK_PATH}#access_token=SYNTHETIC_ACCESS&refresh_token=SYNTHETIC_REFRESH&token_type=bearer`;
    const out = sanitizeAuthCallbackHref(input);
    expect(out).not.toMatch(/SYNTHETIC_ACCESS/);
    expect(out).not.toMatch(/SYNTHETIC_REFRESH/);
    expect(out).not.toMatch(/access_token=/);
    expect(out).not.toMatch(/refresh_token=/);
  });

  it("preserves hash when stripHash is false", () => {
    const input = `${origin}${AUTH_CALLBACK_PATH}?code=SYNTHETIC_Q#access_token=SYNTHETIC_H`;
    const out = sanitizeAuthCallbackHref(input, { stripHash: false });
    expect(out).not.toMatch(/SYNTHETIC_Q/);
    expect(out).not.toMatch(/[?&]code=/);
    expect(out).toMatch(/SYNTHETIC_H/);
    expect(out).toMatch(/access_token=/);
  });

  it("strips mixed query + hash secrets when stripHash true", () => {
    const input = `${origin}${AUTH_CALLBACK_PATH}?code=SYNTHETIC_Q#access_token=SYNTHETIC_H`;
    const out = sanitizeAuthCallbackHref(input, { stripHash: true });
    expect(out).not.toMatch(/SYNTHETIC_Q/);
    expect(out).not.toMatch(/SYNTHETIC_H/);
  });

  it("leaves non-callback URLs unchanged", () => {
    const input = `${origin}/projects/abc?code=should-stay`;
    expect(sanitizeAuthCallbackHref(input)).toBe(input);
  });

  it("is idempotent on already-clean callback URLs", () => {
    const clean = `${origin}${AUTH_CALLBACK_PATH}?type=email&flow=magiclink`;
    expect(sanitizeAuthCallbackHref(clean)).toBe(clean);
    expect(sanitizeAuthCallbackHref(sanitizeAuthCallbackHref(clean))).toBe(clean);
  });
});

describe("bootstrap capture / consume", () => {
  it("extracts PKCE code and type from href", () => {
    const cap = extractAuthCallbackBootstrapFromHref(
      "https://app.example/auth/callback?code=SYNTHETIC_CODE&type=email",
    );
    expect(cap).toEqual({ code: "SYNTHETIC_CODE", type: "email" });
  });

  it("extracts magic-link token_hash and type", () => {
    const cap = extractAuthCallbackBootstrapFromHref(
      "https://app.example/auth/callback?token_hash=SYNTHETIC_TOKEN_HASH&type=email",
    );
    expect(cap).toEqual({ tokenHash: "SYNTHETIC_TOKEN_HASH", type: "email" });
  });

  it("returns null for non-callback paths", () => {
    expect(
      extractAuthCallbackBootstrapFromHref("https://app.example/projects/x?code=SYNTHETIC"),
    ).toBeNull();
  });

  it("take returns secrets; clear then take returns empty", () => {
    storeAuthCallbackBootstrapCapture({ code: "SYNTHETIC_CODE", type: "email" });
    const first = takeAuthCallbackBootstrapCapture();
    expect(first).toEqual({ code: "SYNTHETIC_CODE", type: "email" });
    // Claim survives second take until clear (Strict Mode remount resilience).
    expect(takeAuthCallbackBootstrapCapture()).toEqual({ code: "SYNTHETIC_CODE", type: "email" });
    clearAuthCallbackBootstrapCapture();
    expect(takeAuthCallbackBootstrapCapture()).toBeNull();
  });

  it("consume is one-shot hard clear", () => {
    storeAuthCallbackBootstrapCapture({ tokenHash: "SYNTHETIC_HASH", type: "email" });
    expect(consumeAuthCallbackBootstrapCapture()).toEqual({
      tokenHash: "SYNTHETIC_HASH",
      type: "email",
    });
    expect(consumeAuthCallbackBootstrapCapture()).toBeNull();
    expect(__peekAuthCallbackBootstrapStateForTests()).toEqual({
      pending: null,
      claimed: null,
      bootstrapClaimed: false,
    });
  });
});

describe("prepareAuthCallbackLocationForReplay", () => {
  it("captures PKCE code then strips query secrets; preserves hash", () => {
    const replaceState = vi.fn((...args: unknown[]) => {
      const url = String(args[2] ?? "");
      // Reflect cleaned URL for subsequent location reads.
      win.location.href = `https://app.example${url.startsWith("/") ? url : `/${url}`}`;
      win.location.search = url.includes("?") ? `?${url.split("?")[1]?.split("#")[0] ?? ""}` : "";
      win.location.hash = url.includes("#") ? `#${url.split("#")[1] ?? ""}` : "";
    });
    const win = {
      location: {
        href: "https://app.example/auth/callback?code=SYNTHETIC_CODE&type=email#access_token=SYNTHETIC_ACCESS",
        pathname: "/auth/callback",
        origin: "https://app.example",
        search: "?code=SYNTHETIC_CODE&type=email",
        hash: "#access_token=SYNTHETIC_ACCESS",
      },
      history: {
        state: null,
        replaceState,
      },
    };

    const changed = prepareAuthCallbackLocationForReplay(win as unknown as Window);
    expect(changed).toBe(true);
    expect(replaceState).toHaveBeenCalled();
    const next = String(replaceState.mock.calls[0]?.[2] ?? "");
    expect(next).not.toMatch(/SYNTHETIC_CODE/);
    expect(next).not.toMatch(/[?&]code=/);
    expect(next).toMatch(/type=email/);
    // Hash preserved for detectSessionInUrl
    expect(next).toMatch(/SYNTHETIC_ACCESS/);

    const taken = takeAuthCallbackBootstrapCapture();
    expect(taken?.code).toBe("SYNTHETIC_CODE");
    expect(taken?.type).toBe("email");
  });

  it("captures magic-link token_hash then strips it from query", () => {
    const replaceState = vi.fn();
    const win = {
      location: {
        href: "https://app.example/auth/callback?token_hash=SYNTHETIC_TOKEN_HASH&type=email&flow=magiclink",
        pathname: "/auth/callback",
        origin: "https://app.example",
      },
      history: { state: null, replaceState },
    };

    expect(prepareAuthCallbackLocationForReplay(win as unknown as Window)).toBe(true);
    const next = String(replaceState.mock.calls[0]?.[2] ?? "");
    expect(next).not.toMatch(/SYNTHETIC_TOKEN_HASH/);
    expect(next).not.toMatch(/token_hash=/);
    expect(next).toMatch(/type=email/);
    expect(takeAuthCallbackBootstrapCapture()?.tokenHash).toBe("SYNTHETIC_TOKEN_HASH");
  });

  it("no-ops off auth callback and does not capture", () => {
    const replaceState = vi.fn();
    const win = {
      location: {
        href: "https://app.example/projects/x?code=keep",
        pathname: "/projects/x",
        origin: "https://app.example",
      },
      history: { state: null, replaceState },
    };
    expect(prepareAuthCallbackLocationForReplay(win as unknown as Window)).toBe(false);
    expect(replaceState).not.toHaveBeenCalled();
    expect(takeAuthCallbackBootstrapCapture()).toBeNull();
  });

  it("no-ops when window/history unavailable (SSR)", () => {
    expect(prepareAuthCallbackLocationForReplay(undefined as unknown as Window)).toBe(false);
    expect(takeAuthCallbackBootstrapCapture()).toBeNull();
  });
});

describe("stripSensitiveAuthCallbackLocation", () => {
  it("replaceState removes secrets from auth callback location", () => {
    const replaceState = vi.fn();
    const win = {
      location: {
        href: "https://app.example/auth/callback?code=SYNTHETIC_CODE&type=email#access_token=SYNTHETIC_ACCESS",
        pathname: "/auth/callback",
        origin: "https://app.example",
      },
      history: {
        state: null,
        replaceState,
      },
    };

    const changed = stripSensitiveAuthCallbackLocation(win as unknown as Window);
    expect(changed).toBe(true);
    expect(replaceState).toHaveBeenCalledTimes(1);
    const next = String(replaceState.mock.calls[0]?.[2] ?? "");
    expect(next).not.toMatch(/SYNTHETIC_CODE/);
    expect(next).not.toMatch(/SYNTHETIC_ACCESS/);
    expect(next).toMatch(/type=email/);
  });

  it("no-ops off auth callback", () => {
    const replaceState = vi.fn();
    const win = {
      location: {
        href: "https://app.example/projects/x?code=keep",
        pathname: "/projects/x",
        origin: "https://app.example",
      },
      history: { state: null, replaceState },
    };
    expect(stripSensitiveAuthCallbackLocation(win as unknown as Window)).toBe(false);
    expect(replaceState).not.toHaveBeenCalled();
  });
});

describe("init-order probe — capture before strip before synthetic Replay URL read", () => {
  it("Replay-visible URL has no secret while complete can receive bootstrap code", () => {
    const order: string[] = [];
    const replaceState = vi.fn((...args: unknown[]) => {
      order.push("replaceState");
      const relative = String(args[2] ?? "");
      win.location.href = `https://app.example${relative}`;
      win.location.search = relative.includes("?")
        ? `?${relative.split("?")[1]?.split("#")[0] ?? ""}`
        : "";
    });
    const win = {
      location: {
        href: "https://app.example/auth/callback?code=SYNTHETIC_CODE&token_hash=SYNTHETIC_TOKEN_HASH&type=email",
        pathname: "/auth/callback",
        origin: "https://app.example",
        search: "?code=SYNTHETIC_CODE&token_hash=SYNTHETIC_TOKEN_HASH&type=email",
        hash: "",
      },
      history: { state: null, replaceState },
    };

    order.push("before-prepare");
    prepareAuthCallbackLocationForReplay(win as unknown as Window);
    order.push("after-prepare");

    // Synthetic Replay setInitialState read
    const replayInitialUrl = win.location.href;
    order.push("replay-read");

    expect(replayInitialUrl).not.toMatch(/SYNTHETIC_CODE/);
    expect(replayInitialUrl).not.toMatch(/SYNTHETIC_TOKEN_HASH/);
    expect(replayInitialUrl).not.toMatch(/[?&]code=/);
    expect(replayInitialUrl).not.toMatch(/token_hash=/);

    const bootstrap = takeAuthCallbackBootstrapCapture();
    order.push("route-take");
    expect(bootstrap?.code).toBe("SYNTHETIC_CODE");
    expect(bootstrap?.tokenHash).toBe("SYNTHETIC_TOKEN_HASH");
    expect(bootstrap?.type).toBe("email");

    clearAuthCallbackBootstrapCapture();
    expect(takeAuthCallbackBootstrapCapture()).toBeNull();

    expect(order).toEqual([
      "before-prepare",
      "replaceState",
      "after-prepare",
      "replay-read",
      "route-take",
    ]);
  });
});

describe("scrubUrlForReplay / scrubReplayRecordingEvent", () => {
  it("redacts project UUID paths and strips query/hash", () => {
    const uuid = "10fe6c5b-905b-42b6-abac-fb313728bd67";
    const out = scrubUrlForReplay(
      `https://www.refurbgenius.info/projects/${uuid}/estimate?token=SYNTHETIC_SIGNED`,
    );
    expect(out).not.toMatch(uuid);
    expect(out).not.toMatch(/SYNTHETIC_SIGNED/);
    expect(out).not.toMatch(/\?/);
    expect(out).toMatch(/\/projects\/\$id\/estimate$/);
  });

  it("scrubs navigation performanceSpan payload URLs (custom events only)", () => {
    const event = {
      type: 5,
      timestamp: 1,
      data: {
        tag: "performanceSpan" as const,
        payload: {
          op: "navigation.push",
          description: "https://www.refurbgenius.info/auth/callback?code=SYNTHETIC_NAV",
          data: {
            previous: "https://www.refurbgenius.info/auth/callback#access_token=SYNTHETIC_PREV",
          },
        },
      },
    };

    const scrubbed = scrubReplayRecordingEvent(event);
    const payload = scrubbed.data.payload as {
      description: string;
      data: { previous: string };
    };
    expect(payload.description).not.toMatch(/SYNTHETIC_NAV/);
    expect(payload.data.previous).not.toMatch(/SYNTHETIC_PREV/);
  });

  it("does not modify non-custom Replay event tags", () => {
    const event = {
      type: 2,
      data: {
        tag: "mutation",
        payload: { description: "https://x/auth/callback?code=SYNTHETIC_DOM" },
      },
    };
    expect(scrubReplayRecordingEvent(event)).toEqual(event);
  });
});
