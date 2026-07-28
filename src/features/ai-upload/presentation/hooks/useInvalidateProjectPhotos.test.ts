/**
 * AO-1I1 — useInvalidateProjectPhotos: product photo-list invalidation only.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { projectKeys } from "@/lib/queries/projects";
import { useInvalidateProjectPhotos } from "./useInvalidateProjectPhotos";

const PROJECT_A = "project-a";
const PROJECT_B = "project-b";

function createWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

function createQc() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

describe("useInvalidateProjectPhotos", () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = createQc();
  });

  it("invalidates projectKeys.photosByProject(projectId) once per call", () => {
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useInvalidateProjectPhotos(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    result.current();

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy.mock.calls[0]![0]).toEqual({
      queryKey: projectKeys.photosByProject(PROJECT_A),
    });
  });

  it("concrete key is [projects, projectId, photos]", () => {
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useInvalidateProjectPhotos(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    result.current();

    const key = invalidateSpy.mock.calls[0]![0]?.queryKey as unknown[];
    expect(key).toEqual(["projects", PROJECT_A, "photos"]);
  });

  it("invokes once per callback invocation (not once for lifetime)", () => {
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useInvalidateProjectPhotos(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    result.current();
    result.current();
    result.current();

    expect(invalidateSpy).toHaveBeenCalledTimes(3);
  });

  it("isolates project A and project B keys", () => {
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result: resultA } = renderHook(() => useInvalidateProjectPhotos(PROJECT_A), {
      wrapper: createWrapper(qc),
    });
    const { result: resultB } = renderHook(() => useInvalidateProjectPhotos(PROJECT_B), {
      wrapper: createWrapper(qc),
    });

    resultA.current();
    resultB.current();

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy.mock.calls[0]![0]).toEqual({
      queryKey: projectKeys.photosByProject(PROJECT_A),
    });
    expect(invalidateSpy.mock.calls[1]![0]).toEqual({
      queryKey: projectKeys.photosByProject(PROJECT_B),
    });
  });

  it("does not invalidate unrelated keys", () => {
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useInvalidateProjectPhotos(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    result.current();

    const keys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey as unknown[]);
    for (const key of keys) {
      expect(key).not.toEqual(projectKeys.all);
      expect(key).not.toEqual(projectKeys.byId(PROJECT_A));
      expect(key).not.toEqual(projectKeys.estimateByProject(PROJECT_A));
      expect(key).not.toEqual(projectKeys.financialsByProject(PROJECT_A));
      expect(Array.isArray(key) && key[0] === "room-estimate").toBe(false);
    }
  });

  it("returns a synchronous void function", () => {
    const { result } = renderHook(() => useInvalidateProjectPhotos(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    expect(typeof result.current).toBe("function");
    const returned = result.current();
    expect(returned).toBeUndefined();
  });

  it("does not throw when invalidateQueries rejects", async () => {
    vi.spyOn(qc, "invalidateQueries").mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useInvalidateProjectPhotos(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    expect(() => result.current()).not.toThrow();
    // Allow the rejected void promise to settle without unhandled rejection noise.
    await Promise.resolve();
    await Promise.resolve();
  });

  it("source module has no setQueryData, getQueryData, cancelQueries, useMutation, or pending state", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(
        process.cwd(),
        "src/features/ai-upload/presentation/hooks/useInvalidateProjectPhotos.ts",
      ),
      "utf8",
    );
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(stripped).toMatch(/useQueryClient/);
    expect(stripped).toMatch(/invalidateQueries/);
    expect(stripped).toMatch(/projectKeys\.photosByProject/);
    expect(stripped).not.toMatch(/setQueryData/);
    expect(stripped).not.toMatch(/getQueryData/);
    expect(stripped).not.toMatch(/cancelQueries/);
    expect(stripped).not.toMatch(/removeQueries/);
    expect(stripped).not.toMatch(/resetQueries/);
    expect(stripped).not.toMatch(/useMutation/);
    expect(stripped).not.toMatch(/isPending/);
    expect(stripped).not.toMatch(/supabase/);
    expect(stripped).not.toMatch(/storage/i);
  });
});
