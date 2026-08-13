import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyToken = vi.fn();

vi.mock("@repo/supabase/server", () => ({
  verifyToken: (...args: unknown[]) => verifyToken(...args),
  createTokenSupabase: vi.fn(),
}));

import {
  parseBearerAuthorization,
  requireMobileBearer,
  resolveAuthoritativeUserId,
} from "./mobile-bearer.server";

describe("parseBearerAuthorization", () => {
  it("rejects missing header", () => {
    expect(parseBearerAuthorization(null)).toEqual({ ok: false, reason: "missing" });
    expect(parseBearerAuthorization("")).toEqual({ ok: false, reason: "missing" });
  });

  it("rejects wrong scheme", () => {
    expect(parseBearerAuthorization("Basic abc")).toEqual({ ok: false, reason: "scheme" });
  });

  it("rejects empty Bearer token", () => {
    expect(parseBearerAuthorization("Bearer")).toEqual({ ok: false, reason: "empty" });
    expect(parseBearerAuthorization("Bearer ")).toEqual({ ok: false, reason: "empty" });
  });

  it("accepts valid Bearer token", () => {
    expect(parseBearerAuthorization("Bearer synthetic.jwt.token")).toEqual({
      ok: true,
      token: "synthetic.jwt.token",
    });
  });
});

describe("requireMobileBearer", () => {
  beforeEach(() => {
    verifyToken.mockReset();
  });

  it("returns 401 when header missing", async () => {
    const result = await requireMobileBearer(
      new Request("https://www.refurbgenius.info/api/mobile/v1/session/ping"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it("returns 401 for wrong scheme", async () => {
    const result = await requireMobileBearer(
      new Request("https://www.refurbgenius.info/x", {
        headers: { Authorization: "Basic nope" },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("returns 401 for invalid token", async () => {
    verifyToken.mockRejectedValue(new Error("Unauthorized: invalid token"));
    const result = await requireMobileBearer(
      new Request("https://www.refurbgenius.info/x", {
        headers: { Authorization: "Bearer invalid.token" },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const body = await result.response.text();
      expect(body).not.toContain("invalid.token");
    }
  });

  it("establishes user from verified token only", async () => {
    verifyToken.mockResolvedValue({
      supabase: { from: vi.fn() },
      userId: "user-from-token",
      user: { id: "user-from-token", email: "a@example.com" },
    });

    const result = await requireMobileBearer(
      new Request("https://www.refurbgenius.info/x", {
        headers: { Authorization: "Bearer valid.synthetic.token" },
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userId).toBe("user-from-token");
      expect(result.user.id).toBe("user-from-token");
    }
    expect(verifyToken).toHaveBeenCalledWith("valid.synthetic.token");
  });
});

describe("resolveAuthoritativeUserId", () => {
  it("never lets client-supplied userId override token identity", () => {
    expect(resolveAuthoritativeUserId("token-user", "attacker-user")).toBe("token-user");
    expect(resolveAuthoritativeUserId("token-user", null)).toBe("token-user");
    expect(resolveAuthoritativeUserId("token-user", undefined)).toBe("token-user");
  });
});
