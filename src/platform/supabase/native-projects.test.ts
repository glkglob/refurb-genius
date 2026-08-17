import { describe, it, expect, vi } from "vitest";
import {
  createProjectWithClient,
  getProjectWithClient,
  listProjectsWithClient,
} from "./native-projects";

type SessionState = {
  access_token?: string;
  expires_at?: number;
  user?: { id: string } | null;
} | null;

function secondsFromNow(delta: number): number {
  return Math.floor(Date.now() / 1000) + delta;
}

function mockClient(opts: {
  session?: SessionState;
  refreshSession?: SessionState;
  getSessionError?: { message: string } | null;
  refreshError?: { message: string } | null;
  getSessionThrows?: boolean;
  refreshThrows?: boolean;
  list?: unknown[];
  listError?: { message: string } | null;
  insertRow?: unknown;
  insertError?: { message: string } | null;
  detailRow?: unknown;
  detailError?: { message: string } | null;
}) {
  const order = vi.fn(async () => ({
    data: opts.list ?? [],
    error: opts.listError ?? null,
  }));
  const maybeSingle = vi.fn(async () => ({
    data: opts.detailRow ?? null,
    error: opts.detailError ?? null,
  }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const selectList = vi.fn(() => ({ order, eq }));
  const single = vi.fn(async () => ({
    data: opts.insertRow ?? null,
    error: opts.insertError ?? null,
  }));
  const selectInsert = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select: selectInsert }));
  const from = vi.fn(() => ({
    select: selectList,
    insert,
  }));

  let session: SessionState =
    opts.session === undefined
      ? {
          access_token: "tok-valid",
          expires_at: secondsFromNow(3600),
          user: { id: "user-1" },
        }
      : opts.session;

  const getSession = vi.fn(async () => {
    if (opts.getSessionThrows) throw new Error("session storage failed");
    return {
      data: { session },
      error: opts.getSessionError ?? null,
    };
  });
  const refreshSession = vi.fn(async () => {
    if (opts.refreshThrows) throw new Error("refresh boom");
    if (opts.refreshError) {
      return { data: { session: null }, error: opts.refreshError };
    }
    const next = opts.refreshSession ?? null;
    session = next;
    return {
      data: { session: next },
      error: next ? null : { message: "refresh returned no session" },
    };
  });
  const getUser = vi.fn(async () => ({
    data: { user: session?.user ?? null },
    error: null,
  }));

  return {
    client: {
      from,
      auth: {
        getSession,
        refreshSession,
        getUser,
      },
    } as never,
    from,
    insert,
    getSession,
    refreshSession,
    getUser,
  };
}

describe("native project data plane foundation", () => {
  it("lists projects via provided client (RLS-bound)", async () => {
    const rows = [{ id: "p1", name: "A" }];
    const { client } = mockClient({ list: rows });
    await expect(listProjectsWithClient(client)).resolves.toEqual(rows);
  });

  it("creates project with user_id from the aligned native session only", async () => {
    const row = { id: "p-new", name: "N", user_id: "user-1" };
    const { client, insert, refreshSession, getUser } = mockClient({ insertRow: row });

    const result = await createProjectWithClient(client, {
      name: "N",
      user_id: "forged-from-form",
    } as never);

    expect(result).toEqual(row);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        name: "N",
        region: "London",
      }),
    );
    expect(insert).not.toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "forged-from-form" }),
    );
    expect(refreshSession).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("refreshes an expired native session then inserts with the refreshed user id", async () => {
    const row = { id: "p-new", name: "N", user_id: "user-refreshed" };
    const { client, insert, refreshSession, getUser } = mockClient({
      session: {
        access_token: "tok-old",
        expires_at: secondsFromNow(-30),
        user: { id: "user-stale" },
      },
      refreshSession: {
        access_token: "tok-new",
        expires_at: secondsFromNow(3600),
        user: { id: "user-refreshed" },
      },
      insertRow: row,
    });

    const result = await createProjectWithClient(client, { name: "N" });

    expect(result).toEqual(row);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-refreshed",
        name: "N",
      }),
    );
    expect(getUser).not.toHaveBeenCalled();
  });

  it("refreshes a near-expiry native session then inserts", async () => {
    const row = { id: "p-near", name: "N", user_id: "user-1" };
    const { client, insert, refreshSession } = mockClient({
      session: {
        access_token: "tok-old",
        expires_at: secondsFromNow(30),
        user: { id: "user-1" },
      },
      refreshSession: {
        access_token: "tok-new",
        expires_at: secondsFromNow(3600),
        user: { id: "user-1" },
      },
      insertRow: row,
    });

    await expect(createProjectWithClient(client, { name: "N" })).resolves.toEqual(row);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-1" }));
  });

  it("does not insert when native token refresh fails", async () => {
    const { client, insert, refreshSession } = mockClient({
      session: {
        access_token: "tok-old",
        expires_at: secondsFromNow(-30),
        user: { id: "user-1" },
      },
      refreshError: { message: "invalid refresh tok-old" },
    });

    await expect(createProjectWithClient(client, { name: "X" })).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toBeInstanceOf(Error);
        const message = error instanceof Error ? error.message : String(error);
        expect(message).toMatch(/session expired/i);
        expect(message).not.toContain("tok-old");
        return true;
      },
    );
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(insert).not.toHaveBeenCalled();
  });

  it("fails closed when native session has no access token", async () => {
    const { client, insert, refreshSession } = mockClient({ session: null });
    await expect(createProjectWithClient(client, { name: "X" })).rejects.toThrow(/signed in/i);
    expect(refreshSession).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("fails closed when a usable token has no session user id", async () => {
    const { client, insert, refreshSession } = mockClient({
      session: {
        access_token: "tok-valid",
        expires_at: secondsFromNow(3600),
        user: null,
      },
    });
    await expect(createProjectWithClient(client, { name: "X" })).rejects.toThrow(/signed in/i);
    expect(refreshSession).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("derives South West England from BS16 2EG instead of defaulting London", async () => {
    const row = { id: "p-bs", name: "New", region: "South West England" };
    const { client, insert } = mockClient({ insertRow: row });

    await createProjectWithClient(client, {
      name: "New",
      postcode: "BS16 2EG",
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        postcode: "BS16 2EG",
        region: "South West England",
      }),
    );
  });

  it("rejects unknown postcode without an explicit region", async () => {
    const { client, insert } = mockClient({});
    await expect(
      createProjectWithClient(client, { name: "X", postcode: "ZZ1 1ZZ" }),
    ).rejects.toThrow(/recognised UK postcode or choose a region/i);
    expect(insert).not.toHaveBeenCalled();
  });

  it("reads one project via provided client (RLS-bound)", async () => {
    const row = { id: "p1", name: "A" };
    const { client } = mockClient({ detailRow: row });
    await expect(getProjectWithClient(client, "p1")).resolves.toEqual(row);
  });

  it("returns null when the native detail row is absent", async () => {
    const { client } = mockClient({ detailRow: null });
    await expect(getProjectWithClient(client, "missing")).resolves.toBeNull();
  });
});
