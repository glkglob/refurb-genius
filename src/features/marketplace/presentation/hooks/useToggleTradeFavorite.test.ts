import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { marketplaceKeys } from "@/lib/queries/marketplace";
import type { Tables } from "@repo/supabase";

type TradeFavoriteRow = Tables<"trade_favorites">;

const addTradeFavorite = vi.fn();
const removeTradeFavorite = vi.fn();

vi.mock("@/lib/marketplace-write", () => ({
  addTradeFavorite: (...args: unknown[]) => addTradeFavorite(...args),
  removeTradeFavorite: (...args: unknown[]) => removeTradeFavorite(...args),
}));

import { useToggleTradeFavorite } from "./useToggleTradeFavorite";

const USER_A = "user-a";
const USER_B = "user-b";
const TP = "tp-1";

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

function seedFavorites(qc: QueryClient, userId: string, rows: TradeFavoriteRow[]) {
  qc.setQueryData(marketplaceKeys.favoritesByUser(userId), rows);
}

beforeEach(() => {
  addTradeFavorite.mockReset();
  removeTradeFavorite.mockReset();
});

describe("useToggleTradeFavorite", () => {
  it("add calls addTradeFavorite with exact IDs", async () => {
    addTradeFavorite.mockResolvedValue({
      id: "fav-1",
      userId: USER_A,
      tradespersonId: TP,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const qc = createQc();
    seedFavorites(qc, USER_A, []);

    const { result } = renderHook(() => useToggleTradeFavorite(USER_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        userId: USER_A,
        tradespersonId: TP,
        isFavorited: false,
      });
    });

    expect(addTradeFavorite).toHaveBeenCalledWith({
      userId: USER_A,
      tradespersonId: TP,
    });
    expect(removeTradeFavorite).not.toHaveBeenCalled();
  });

  it("remove calls removeTradeFavorite with exact favorite ID", async () => {
    removeTradeFavorite.mockResolvedValue(undefined);
    const qc = createQc();
    seedFavorites(qc, USER_A, [
      {
        id: "fav-9",
        user_id: USER_A,
        tradesperson_id: TP,
        created_at: "2026-01-01T00:00:00.000Z",
      } as TradeFavoriteRow,
    ]);

    const { result } = renderHook(() => useToggleTradeFavorite(USER_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        userId: USER_A,
        tradespersonId: TP,
        isFavorited: true,
        favoriteId: "fav-9",
      });
    });

    expect(removeTradeFavorite).toHaveBeenCalledWith({ favoriteId: "fav-9" });
    expect(addTradeFavorite).not.toHaveBeenCalled();
  });

  it("cancels favorites query and optimistically adds a temp record", async () => {
    let resolveAdd: (v: unknown) => void = () => {};
    addTradeFavorite.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAdd = resolve;
        }),
    );
    const qc = createQc();
    seedFavorites(qc, USER_A, []);
    const cancelSpy = vi.spyOn(qc, "cancelQueries");

    const { result } = renderHook(() => useToggleTradeFavorite(USER_A), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.mutate({
        userId: USER_A,
        tradespersonId: TP,
        isFavorited: false,
      });
    });

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith({
        queryKey: marketplaceKeys.favoritesByUser(USER_A),
      });
    });

    const mid = qc.getQueryData<TradeFavoriteRow[]>(marketplaceKeys.favoritesByUser(USER_A));
    expect(mid).toHaveLength(1);
    expect(mid![0].tradesperson_id).toBe(TP);
    expect(mid![0].id).toMatch(/^temp-/);

    resolveAdd({
      id: "fav-canonical",
      userId: USER_A,
      tradespersonId: TP,
      createdAt: "2026-01-02T00:00:00.000Z",
    });

    await waitFor(() => {
      const after = qc.getQueryData<TradeFavoriteRow[]>(marketplaceKeys.favoritesByUser(USER_A));
      expect(after?.some((f) => f.id === "fav-canonical")).toBe(true);
      expect(after?.some((f) => String(f.id).startsWith("temp-"))).toBe(false);
    });
  });

  it("optimistically removes only the matching tradesperson favorite", async () => {
    removeTradeFavorite.mockImplementation(() => new Promise(() => {}));
    const qc = createQc();
    seedFavorites(qc, USER_A, [
      {
        id: "fav-1",
        user_id: USER_A,
        tradesperson_id: TP,
        created_at: "2026-01-01T00:00:00.000Z",
      } as TradeFavoriteRow,
      {
        id: "fav-2",
        user_id: USER_A,
        tradesperson_id: "tp-other",
        created_at: "2026-01-01T00:00:00.000Z",
      } as TradeFavoriteRow,
    ]);

    const { result } = renderHook(() => useToggleTradeFavorite(USER_A), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.mutate({
        userId: USER_A,
        tradespersonId: TP,
        isFavorited: true,
        favoriteId: "fav-1",
      });
    });

    await waitFor(() => {
      const mid = qc.getQueryData<TradeFavoriteRow[]>(marketplaceKeys.favoritesByUser(USER_A));
      expect(mid?.map((f) => f.id)).toEqual(["fav-2"]);
    });
  });

  it("add failure restores previous snapshot even when cache was empty", async () => {
    addTradeFavorite.mockRejectedValue(new Error("network"));
    const qc = createQc();
    // No seed — previous cache is undefined (first interaction).
    const key = marketplaceKeys.favoritesByUser(USER_A);
    const setSpy = vi.spyOn(qc, "setQueryData");

    const { result } = renderHook(() => useToggleTradeFavorite(USER_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          userId: USER_A,
          tradespersonId: TP,
          isFavorited: false,
        });
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    // Rollback must write the empty snapshot (not leave temp row if invalidate is slow).
    const rollbackCalls = setSpy.mock.calls.filter(
      (c) =>
        JSON.stringify(c[0]) === JSON.stringify(key) && Array.isArray(c[1]) && c[1].length === 0,
    );
    expect(rollbackCalls.length).toBeGreaterThanOrEqual(1);
    expect(result.current.error?.message).toBe("network");
  });

  it("remove failure restores previous snapshot", async () => {
    removeTradeFavorite.mockRejectedValue(new Error("boom"));
    const qc = createQc();
    const previous = [
      {
        id: "fav-1",
        user_id: USER_A,
        tradesperson_id: TP,
        created_at: "2026-01-01T00:00:00.000Z",
      } as TradeFavoriteRow,
    ];
    seedFavorites(qc, USER_A, previous);
    const key = marketplaceKeys.favoritesByUser(USER_A);
    const setSpy = vi.spyOn(qc, "setQueryData");

    const { result } = renderHook(() => useToggleTradeFavorite(USER_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          userId: USER_A,
          tradespersonId: TP,
          isFavorited: true,
          favoriteId: "fav-1",
        });
      } catch {
        // expected
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const rollbackToPrevious = setSpy.mock.calls.some(
      (c) =>
        JSON.stringify(c[0]) === JSON.stringify(key) &&
        Array.isArray(c[1]) &&
        (c[1] as TradeFavoriteRow[]).some((f) => f.id === "fav-1"),
    );
    expect(rollbackToPrevious).toBe(true);
    expect(result.current.error?.message).toBe("boom");
  });

  it("refuses to delete with a temp optimistic favorite id", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useToggleTradeFavorite(USER_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          userId: USER_A,
          tradespersonId: TP,
          isFavorited: true,
          favoriteId: "temp-123",
        });
      } catch {
        // expected
      }
    });

    expect(removeTradeFavorite).not.toHaveBeenCalled();
  });

  it("settled invalidates exactly one user favorites key", async () => {
    addTradeFavorite.mockResolvedValue({
      id: "fav-1",
      userId: USER_A,
      tradespersonId: TP,
    });
    const qc = createQc();
    seedFavorites(qc, USER_A, []);
    seedFavorites(qc, USER_B, [
      {
        id: "b-1",
        user_id: USER_B,
        tradesperson_id: TP,
        created_at: "2026-01-01T00:00:00.000Z",
      } as TradeFavoriteRow,
    ]);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useToggleTradeFavorite(USER_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        userId: USER_A,
        tradespersonId: TP,
        isFavorited: false,
      });
    });

    const favoriteInvalidations = invalidateSpy.mock.calls.filter(
      (call) =>
        JSON.stringify(call[0]?.queryKey) ===
        JSON.stringify(marketplaceKeys.favoritesByUser(USER_A)),
    );
    expect(favoriteInvalidations).toHaveLength(1);

    // User B cache untouched by invalidation key
    expect(
      invalidateSpy.mock.calls.some(
        (call) =>
          JSON.stringify(call[0]?.queryKey) ===
          JSON.stringify(marketplaceKeys.favoritesByUser(USER_B)),
      ),
    ).toBe(false);
  });

  it("User A mutation never writes User B cache optimistically", async () => {
    addTradeFavorite.mockImplementation(() => new Promise(() => {}));
    const qc = createQc();
    seedFavorites(qc, USER_A, []);
    const bRows = [
      {
        id: "b-1",
        user_id: USER_B,
        tradesperson_id: "other",
        created_at: "2026-01-01T00:00:00.000Z",
      } as TradeFavoriteRow,
    ];
    seedFavorites(qc, USER_B, bRows);

    const { result } = renderHook(() => useToggleTradeFavorite(USER_A), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.mutate({
        userId: USER_A,
        tradespersonId: TP,
        isFavorited: false,
      });
    });

    await waitFor(() => {
      expect(
        qc.getQueryData<TradeFavoriteRow[]>(marketplaceKeys.favoritesByUser(USER_A))?.length,
      ).toBe(1);
    });
    expect(qc.getQueryData(marketplaceKeys.favoritesByUser(USER_B))).toEqual(bRows);
  });

  it("empty userId fails without remote call", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useToggleTradeFavorite(undefined), {
      wrapper: createWrapper(qc),
    });

    let caught: Error | undefined;
    await act(async () => {
      try {
        await result.current.mutateAsync({
          userId: "",
          tradespersonId: TP,
          isFavorited: false,
        });
      } catch (e) {
        caught = e as Error;
      }
    });

    expect(addTradeFavorite).not.toHaveBeenCalled();
    expect(caught?.message).toMatch(/Sign in|required/i);
  });
});
