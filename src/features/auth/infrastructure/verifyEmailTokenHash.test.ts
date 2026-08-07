/**
 * P0-AUTH-1 — Email token-hash Auth primitive contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const verifyOtp = vi.fn();

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    auth: {
      verifyOtp: (...args: unknown[]) => verifyOtp(...args),
    },
  },
}));

import { verifyEmailTokenHash } from "./verifyEmailTokenHash";

const SRC = join(__dirname, "verifyEmailTokenHash.ts");

beforeEach(() => {
  verifyOtp.mockReset();
  verifyOtp.mockResolvedValue({
    data: { user: { id: "u1", email: "a@b.com" }, session: {} },
    error: null,
  });
});

describe("verifyEmailTokenHash", () => {
  it("uses platform browser Auth client via @/platform/supabase/browser", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).toMatch(/@\/platform\/supabase\/browser/);
    expect(src).toMatch(/supabase\.auth\.verifyOtp/);
  });

  it("calls verifyOtp once with exact token_hash and type email", async () => {
    await verifyEmailTokenHash({ tokenHash: "th-abc" });

    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "th-abc",
      type: "email",
    });
  });

  it("returns the Auth user on success", async () => {
    const user = { id: "u2", email: "x@y.com" };
    verifyOtp.mockResolvedValue({
      data: { user, session: { access_token: "t" } },
      error: null,
    });

    const result = await verifyEmailTokenHash({ tokenHash: "th" });
    expect(result).toEqual({ user });
  });

  it("returns null user when Auth returns null user", async () => {
    verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    const result = await verifyEmailTokenHash({ tokenHash: "th" });
    expect(result).toEqual({ user: null });
  });

  it("throws returned Auth error unchanged", async () => {
    const err = Object.assign(new Error("Token has expired or is invalid"), {
      status: 403,
      code: "otp_expired",
    });
    verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: err,
    });

    await expect(verifyEmailTokenHash({ tokenHash: "bad" })).rejects.toBe(err);
  });

  it("does not include the token hash in a constructed error message", async () => {
    const secretHash = "super-secret-token-hash-value";
    const err = Object.assign(new Error("otp expired"), { status: 403 });
    verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: err,
    });

    await expect(verifyEmailTokenHash({ tokenHash: secretHash })).rejects.toBe(err);
    expect(err.message).not.toContain(secretHash);
  });

  it("propagates a genuinely rejected promise", async () => {
    verifyOtp.mockRejectedValue(new Error("network down"));

    await expect(verifyEmailTokenHash({ tokenHash: "th" })).rejects.toThrow("network down");
  });

  it("remains presentation-free (no QC, nav, logger, window, mapping)", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/getSession|exchangeCodeForSession/);
    expect(src).not.toMatch(/QueryClient|setQueryData|AUTH_USER_QUERY_KEY/);
    expect(src).not.toMatch(/navigate|useNavigate|window\./);
    expect(src).not.toMatch(/\blogger\b|toast|fromSupabaseUser|captureAuthError/);
    expect(src).not.toMatch(/from ["']react["']/);
  });
});
