import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountDeletionError } from "../domain/accountDeletionContract";

const { requireMobileBearer, executeAccountDeletion, createServiceRoleSupabase } = vi.hoisted(
  () => ({
    requireMobileBearer: vi.fn(),
    executeAccountDeletion: vi.fn(),
    createServiceRoleSupabase: vi.fn(),
  }),
);

vi.mock("@/platform/http/mobile-bearer.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/platform/http/mobile-bearer.server")>();
  return {
    ...actual,
    requireMobileBearer: (...args: unknown[]) => requireMobileBearer(...args),
  };
});

vi.mock("@/platform/supabase/service.server", () => ({
  createServiceRoleSupabase: (...args: unknown[]) => createServiceRoleSupabase(...args),
}));

vi.mock("../application/executeAccountDeletion.server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../application/executeAccountDeletion.server")>();
  return {
    ...actual,
    executeAccountDeletion: (...args: unknown[]) => executeAccountDeletion(...args),
  };
});

const { handleMobileAccountDelete } = await import("./mobileAccountDelete.server");

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

function request(body: unknown = {}): Request {
  return new Request("https://www.refurbgenius.info/api/mobile/v1/account/delete", {
    method: "POST",
    headers: {
      authorization: "Bearer synthetic",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("handleMobileAccountDelete", () => {
  beforeEach(() => {
    requireMobileBearer.mockReset();
    executeAccountDeletion.mockReset();
    createServiceRoleSupabase.mockReset();
    requireMobileBearer.mockResolvedValue({
      ok: true,
      userId: USER,
      user: { id: USER },
      supabase: {},
      token: "synthetic",
    });
    createServiceRoleSupabase.mockReturnValue({ marker: "admin" });
    executeAccountDeletion.mockResolvedValue({ success: true });
  });

  it("returns 401 and performs no privileged work when unauthenticated", async () => {
    requireMobileBearer.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });
    const res = await handleMobileAccountDelete(request({ userId: OTHER }));
    expect(res.status).toBe(401);
    expect(executeAccountDeletion).not.toHaveBeenCalled();
    expect(createServiceRoleSupabase).not.toHaveBeenCalled();
  });

  it("uses token identity and ignores forged body userId", async () => {
    const res = await handleMobileAccountDelete(request({ userId: OTHER }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(executeAccountDeletion).toHaveBeenCalledWith(USER, { marker: "admin" });
    expect(executeAccountDeletion.mock.calls[0]?.[0]).not.toBe(OTHER);
  });

  it("does not return success when storage cleanup fails", async () => {
    executeAccountDeletion.mockRejectedValue(
      new AccountDeletionError("storage_cleanup_failed", "Required storage cleanup failed."),
    );
    const res = await handleMobileAccountDelete(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Required storage cleanup failed." });
  });
});
