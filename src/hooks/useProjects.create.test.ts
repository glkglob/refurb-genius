import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "useProjects.ts"), "utf8");

const createProjectForClient = vi.hoisted(() => vi.fn());

vi.mock("@/features/projects/infrastructure/createProjectForClient", () => ({
  createProjectForClient: (input: unknown) => createProjectForClient(input),
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

import { useCreateProject } from "./useProjects";

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useCreateProject", () => {
  beforeEach(() => {
    createProjectForClient.mockReset();
    createProjectForClient.mockResolvedValue({ id: "p1", name: "New House" });
  });

  it("delegates create to createProjectForClient", async () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useCreateProject(), { wrapper: wrapper(qc) });
    const input = { name: "New House" };
    await act(async () => {
      await result.current.mutateAsync(input as never);
    });
    expect(createProjectForClient).toHaveBeenCalledWith(input);
  });

  it("does not import platform supabase (AO-1M4 invariant)", () => {
    expect(SRC).toMatch(/createProjectForClient/);
    expect(SRC).not.toMatch(/@\/platform\/supabase/);
  });
});
