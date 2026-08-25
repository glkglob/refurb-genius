import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ProjectWithProgress } from "@/lib/mappers";

const HOOK_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "useDashboardProjectSummaries.ts"),
  "utf8",
);

const { useQueriesMock, invalidateQueries } = vi.hoisted(() => ({
  useQueriesMock: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueries: (opts: { queries: unknown[] }) => useQueriesMock(opts),
    useQueryClient: () => ({ invalidateQueries }),
  };
});

import { useDashboardProjectSummaries } from "./useDashboardProjectSummaries";

const project: ProjectWithProgress = {
  id: "p1",
  user_id: "u1",
  name: "Terrace",
  address: "1 High St",
  postcode: "E1 1AA",
  region: "London",
  property_type: "Terraced",
  bedrooms: 2,
  bathrooms: 1,
  size_sqm: 80,
  purchase_price: 1,
  estimated_gdv: 1,
  notes: "",
  created_at: "2026-01-01T00:00:00.000Z",
  status: "Draft",
  photos_done: false,
  analysis_done: false,
  estimate_done: false,
  report_done: false,
};

function success(data: unknown) {
  return { isSuccess: true, isError: false, error: null, data };
}

function pending() {
  return { isSuccess: false, isError: false, error: null, data: undefined };
}

function failed(message = "boom") {
  return { isSuccess: false, isError: true, error: new Error(message), data: undefined };
}

type QueryResult =
  | ReturnType<typeof success>
  | ReturnType<typeof pending>
  | ReturnType<typeof failed>;

function resultsForQueries(
  queries: Array<{ queryKey: readonly unknown[]; enabled?: boolean }>,
  byKind: Record<string, QueryResult>,
) {
  return queries.map((query) => {
    const key = query.queryKey;
    if (key[2] === "photos") return byKind.photos;
    const kind = String(key[3]);
    return byKind[kind];
  });
}

describe("useDashboardProjectSummaries", () => {
  beforeEach(() => {
    useQueriesMock.mockReset();
    invalidateQueries.mockReset();
  });

  it("returns ready empty and makes no evidence queries when there are no projects", () => {
    useQueriesMock.mockImplementation(({ queries }: { queries: unknown[] }) => {
      expect(queries).toEqual([]);
      return [];
    });
    const { result } = renderHook(() => useDashboardProjectSummaries([]));
    expect(result.current.status).toBe("ready");
    expect(result.current.summaries).toEqual([]);
    expect(useQueriesMock).toHaveBeenCalledTimes(6);
    expect(useQueriesMock.mock.calls.every((call) => call[0].queries.length === 0)).toBe(true);
  });

  it("does not place projects while first-wave evidence is pending", () => {
    useQueriesMock.mockImplementation(
      ({ queries }: { queries: Array<{ queryKey: readonly unknown[] }> }) =>
        resultsForQueries(queries, {
          photos: pending(),
          roomAnalyses: pending(),
          redesignConcepts: pending(),
          scopeHeader: pending(),
          exportSnapshot: pending(),
          projectEstimate: pending(),
        }),
    );
    const { result } = renderHook(() => useDashboardProjectSummaries([project]));
    expect(result.current.status).toBe("loading");
    expect(result.current.summaries).toEqual([]);
  });

  it("does not enable estimate until first-wave evidence succeeds", () => {
    useQueriesMock.mockImplementation(
      ({ queries }: { queries: Array<{ queryKey: readonly unknown[]; enabled?: boolean }> }) => {
        const kind = queries[0] ? String(queries[0].queryKey[3] ?? queries[0].queryKey[2]) : "";
        if (kind === "projectEstimate") {
          expect(queries[0]?.enabled).toBe(false);
          return [pending()];
        }
        return resultsForQueries(queries, {
          photos: pending(),
          roomAnalyses: pending(),
          redesignConcepts: pending(),
          scopeHeader: pending(),
          exportSnapshot: pending(),
          projectEstimate: pending(),
        });
      },
    );
    renderHook(() => useDashboardProjectSummaries([project]));
  });

  it("does not place projects while estimate is pending after first-wave success", () => {
    useQueriesMock.mockImplementation(
      ({ queries }: { queries: Array<{ queryKey: readonly unknown[]; enabled?: boolean }> }) => {
        const kind = queries[0] ? String(queries[0].queryKey[3] ?? queries[0].queryKey[2]) : "";
        if (kind === "projectEstimate") {
          expect(queries[0]?.enabled).toBe(true);
          expect(queries[0]?.queryKey[4]).toBe("no-scope");
          return [pending()];
        }
        return resultsForQueries(queries, {
          photos: success([]),
          roomAnalyses: success([]),
          redesignConcepts: success([]),
          scopeHeader: success(null),
          exportSnapshot: success(null),
          projectEstimate: pending(),
        });
      },
    );
    const { result } = renderHook(() => useDashboardProjectSummaries([project]));
    expect(result.current.status).toBe("loading");
    expect(result.current.summaries).toEqual([]);
  });

  it("returns workflow-summary error on first-wave failure without counts", () => {
    useQueriesMock.mockImplementation(
      ({ queries }: { queries: Array<{ queryKey: readonly unknown[] }> }) =>
        resultsForQueries(queries, {
          photos: failed("photos down"),
          roomAnalyses: success([]),
          redesignConcepts: success([]),
          scopeHeader: success(null),
          exportSnapshot: success(null),
          projectEstimate: pending(),
        }),
    );
    const { result } = renderHook(() => useDashboardProjectSummaries([project]));
    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toBe("photos down");
    expect(result.current.summaries).toEqual([]);
  });

  it("returns workflow-summary error on estimate failure", () => {
    useQueriesMock.mockImplementation(
      ({ queries }: { queries: Array<{ queryKey: readonly unknown[]; enabled?: boolean }> }) => {
        const kind = queries[0] ? String(queries[0].queryKey[3] ?? queries[0].queryKey[2]) : "";
        if (kind === "projectEstimate") return [failed("estimate down")];
        return resultsForQueries(queries, {
          photos: success([]),
          roomAnalyses: success([]),
          redesignConcepts: success([]),
          scopeHeader: success(null),
          exportSnapshot: success(null),
          projectEstimate: failed("estimate down"),
        });
      },
    );
    const { result } = renderHook(() => useDashboardProjectSummaries([project]));
    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toBe("estimate down");
    expect(result.current.summaries).toEqual([]);
  });

  it("classifies a successful empty-evidence project once under Photos", () => {
    useQueriesMock.mockImplementation(
      ({ queries }: { queries: Array<{ queryKey: readonly unknown[] }> }) =>
        resultsForQueries(queries, {
          photos: success([]),
          roomAnalyses: success([]),
          redesignConcepts: success([]),
          scopeHeader: success(null),
          exportSnapshot: success(null),
          projectEstimate: success(null),
        }),
    );
    const { result } = renderHook(() => useDashboardProjectSummaries([project]));
    expect(result.current.status).toBe("ready");
    expect(result.current.summaries).toHaveLength(1);
    expect(result.current.summaries[0]?.projectId).toBe("p1");
    expect(result.current.summaries[0]?.stage).toBe("photos");
  });

  it("enables estimate with derived current scope id when identities match", () => {
    const photoA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    useQueriesMock.mockImplementation(
      ({ queries }: { queries: Array<{ queryKey: readonly unknown[]; enabled?: boolean }> }) => {
        const kind = queries[0] ? String(queries[0].queryKey[3] ?? queries[0].queryKey[2]) : "";
        if (kind === "projectEstimate") {
          expect(queries[0]?.enabled).toBe(true);
          expect(queries[0]?.queryKey[4]).toBe("s1");
          return [success(null)];
        }
        return resultsForQueries(queries, {
          photos: success([{ id: photoA }]),
          roomAnalyses: success([{ photo_id: photoA, source: "ai" }]),
          redesignConcepts: success([
            { id: "r1", style: "Modern", analysisIdentity: photoA, isSelected: true },
          ]),
          scopeHeader: success({
            id: "s1",
            analysisIdentity: photoA,
            redesignIdentity: "r1",
          }),
          exportSnapshot: success(null),
          projectEstimate: success(null),
        });
      },
    );
    const { result } = renderHook(() => useDashboardProjectSummaries([project]));
    expect(result.current.status).toBe("ready");
  });

  it("does not enable estimate when scope evidence failed", () => {
    useQueriesMock.mockImplementation(
      ({ queries }: { queries: Array<{ queryKey: readonly unknown[]; enabled?: boolean }> }) => {
        const kind = queries[0] ? String(queries[0].queryKey[3] ?? queries[0].queryKey[2]) : "";
        if (kind === "projectEstimate") {
          expect(queries[0]?.enabled).toBe(false);
          return [pending()];
        }
        return resultsForQueries(queries, {
          photos: success([]),
          roomAnalyses: success([]),
          redesignConcepts: success([]),
          scopeHeader: failed("scope down"),
          exportSnapshot: success(null),
          projectEstimate: pending(),
        });
      },
    );
    const { result } = renderHook(() => useDashboardProjectSummaries([project]));
    expect(result.current.status).toBe("error");
  });

  it("retries photos and workflow prefixes", () => {
    useQueriesMock.mockImplementation(
      ({ queries }: { queries: Array<{ queryKey: readonly unknown[] }> }) =>
        resultsForQueries(queries, {
          photos: success([]),
          roomAnalyses: success([]),
          redesignConcepts: success([]),
          scopeHeader: success(null),
          exportSnapshot: success(null),
          projectEstimate: success(null),
        }),
    );
    const { result } = renderHook(() => useDashboardProjectSummaries([project]));
    result.current.retry();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["projects", "p1", "photos"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["projects", "p1", "workflow"] });
  });

  it("associates evidence by current project ids after reorder", () => {
    const second = { ...project, id: "p2", name: "Two" };
    useQueriesMock.mockImplementation(
      ({ queries }: { queries: Array<{ queryKey: readonly unknown[] }> }) =>
        queries.map((query) => {
          const id = String(query.queryKey[1]);
          if (query.queryKey[2] === "photos")
            return success(id === "p2" ? [{ id: "photo-2" }] : []);
          const kind = String(query.queryKey[3] ?? "");
          if (kind === "scopeHeader" || kind === "exportSnapshot" || kind === "projectEstimate") {
            return success(null);
          }
          return success([]);
        }),
    );
    const { result, rerender } = renderHook(({ rows }) => useDashboardProjectSummaries(rows), {
      initialProps: { rows: [project, second] },
    });
    expect(result.current.summaries.map((item) => item.projectId)).toEqual(["p1", "p2"]);
    rerender({ rows: [second, project] });
    expect(result.current.summaries[0]?.projectId).toBe("p2");
    expect(result.current.summaries[1]?.projectId).toBe("p1");
  });

  it("does not use the five-stage presentation hook or list done flags", () => {
    expect(HOOK_SRC).not.toMatch(/useProjectFiveStageWorkflow/);
    expect(HOOK_SRC).not.toMatch(/photos_done|analysis_done|estimate_done|report_done/);
    expect(HOOK_SRC).not.toMatch(/\.catch\(\s*\(\)\s*=>\s*\[\]/);
    expect(HOOK_SRC).not.toMatch(/\.catch\(\s*\(\)\s*=>\s*null/);
    expect(HOOK_SRC.match(/useQueries\(/g)?.length).toBe(6);
  });
});
