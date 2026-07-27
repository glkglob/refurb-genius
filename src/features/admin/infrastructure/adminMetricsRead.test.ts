/**
 * AO-1D1 — admin metrics infrastructure read contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const warn = vi.fn();

vi.mock("@/lib/logger", () => ({
  logger: { warn: (...args: unknown[]) => warn(...args), error: vi.fn(), info: vi.fn() },
}));

type ThenableChain = {
  select: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  then: (
    onFulfilled: (v: unknown) => unknown,
    onRejected?: (e: unknown) => unknown,
  ) => Promise<unknown>;
};

function makeThenable(result: unknown): ThenableChain {
  const chain: ThenableChain = {
    select: vi.fn(),
    gte: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  };
  chain.select.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

const from = vi.fn();

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
  },
}));

import {
  fetchAdminPlatformStats,
  fetchAdminRecentProjects,
  fetchAdminUsers,
  adminRecentActivityThresholdIso,
} from "./adminMetricsRead";

beforeEach(() => {
  from.mockReset();
  warn.mockReset();
});

describe("adminRecentActivityThresholdIso", () => {
  it("uses seven-day formula at call time", () => {
    const now = Date.parse("2026-07-27T12:00:00.000Z");
    expect(adminRecentActivityThresholdIso(now)).toBe(
      new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
    );
  });
});

describe("fetchAdminPlatformStats", () => {
  it("runs R1–R3 concurrently with exact selects and maps soft results", async () => {
    const projectsChain = makeThenable({ count: 12, error: null, data: null });
    const profilesChain = makeThenable({ count: 4, error: null, data: null });
    const activityChain = makeThenable({
      data: [{ id: "a" }, { id: "b" }],
      error: null,
      count: null,
    });

    // Promise.all starts R1/R2/R3 in source order: projects count, profiles count, projects activity.
    let n = 0;
    from.mockImplementation(() => {
      n += 1;
      if (n === 1) return projectsChain;
      if (n === 2) return profilesChain;
      return activityChain;
    });

    const stats = await fetchAdminPlatformStats();

    expect(from).toHaveBeenCalledWith("projects");
    expect(from).toHaveBeenCalledWith("profiles");
    expect(from.mock.calls.filter((c) => c[0] === "projects")).toHaveLength(2);
    expect(n).toBe(3);

    expect(projectsChain.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(profilesChain.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(activityChain.select).toHaveBeenCalledWith("id");
    expect(activityChain.gte).toHaveBeenCalled();
    const gteArg = activityChain.gte.mock.calls[0][0];
    const gteVal = activityChain.gte.mock.calls[0][1];
    expect(gteArg).toBe("created_at");
    const expected = Date.now() - 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(Date.parse(gteVal as string) - expected)).toBeLessThan(5000);

    expect(stats).toEqual({
      totalProjects: 12,
      totalUsers: 4,
      recentActivityCount: 2,
    });
  });

  it("maps null counts and missing data to zero without throwing on PostgREST errors", async () => {
    const projectsChain = makeThenable({ count: null, error: { message: "x" }, data: null });
    const profilesChain = makeThenable({ count: undefined, error: { message: "y" }, data: null });
    const activityChain = makeThenable({ data: null, error: { message: "z" }, count: null });
    let n = 0;
    from.mockImplementation(() => {
      n += 1;
      if (n === 1) return projectsChain;
      if (n === 2) return profilesChain;
      return activityChain;
    });

    await expect(fetchAdminPlatformStats()).resolves.toEqual({
      totalProjects: 0,
      totalUsers: 0,
      recentActivityCount: 0,
    });
  });
});

describe("fetchAdminRecentProjects", () => {
  it("uses exact select, order, limit and returns data", async () => {
    const rows = [
      {
        id: "p1",
        name: "A",
        address: "1 St",
        status: "active",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ];
    const chain = makeThenable({ data: rows, error: null });
    from.mockReturnValue(chain);

    const result = await fetchAdminRecentProjects();

    expect(from).toHaveBeenCalledWith("projects");
    expect(chain.select).toHaveBeenCalledWith("id, name, address, status, created_at");
    expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(5);
    expect(result).toEqual(rows);
  });

  it("returns [] for null data", async () => {
    const chain = makeThenable({ data: null, error: null });
    from.mockReturnValue(chain);
    await expect(fetchAdminRecentProjects()).resolves.toEqual([]);
  });

  it("logs warn and returns [] on returned error", async () => {
    const chain = makeThenable({ data: null, error: { message: "denied" } });
    from.mockReturnValue(chain);
    await expect(fetchAdminRecentProjects()).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledWith("[Admin] Could not load recent projects", {
      error: "denied",
    });
  });
});

describe("fetchAdminUsers", () => {
  it("uses exact select, order, limit and returns data", async () => {
    const rows = [
      {
        id: "u1",
        full_name: "Ada",
        email: "a@b.c",
        role: "admin",
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ];
    const chain = makeThenable({ data: rows, error: null });
    from.mockReturnValue(chain);

    const result = await fetchAdminUsers();

    expect(from).toHaveBeenCalledWith("profiles");
    expect(chain.select).toHaveBeenCalledWith("id, full_name, email, role, created_at");
    expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(10);
    expect(result).toEqual(rows);
  });

  it("returns [] for null data", async () => {
    const chain = makeThenable({ data: null, error: null });
    from.mockReturnValue(chain);
    await expect(fetchAdminUsers()).resolves.toEqual([]);
  });

  it("logs RLS warning and returns [] on returned error", async () => {
    const chain = makeThenable({ data: null, error: { message: "rls" } });
    from.mockReturnValue(chain);
    await expect(fetchAdminUsers()).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledWith("[Admin] Could not load users (RLS may restrict access)", {
      error: "rls",
    });
  });
});

describe("admin metrics read module purity (source)", () => {
  it("contains no React, QueryClient, toast, Auth, or writes", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "adminMetricsRead.ts"), "utf8");
    expect(src).not.toMatch(
      /\buseQuery\b|\buseMutation\b|\bQueryClient\b|\btoast\b|auth\.|\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.upsert\s*\(|\.rpc\s*\(/,
    );
    expect(src).not.toMatch(/from ["']react["']/);
  });
});
