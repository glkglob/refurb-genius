import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const { fromMock, insertMock, deleteEqMock, deleteMock, selectMock, singleMock } = vi.hoisted(
  () => {
    const singleMock = vi.fn();
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));
    const deleteEqMock = vi.fn();
    const deleteMock = vi.fn(() => ({ eq: deleteEqMock }));
    const fromMock = vi.fn((table: string) => {
      if (table === "trade_favorites") {
        return {
          insert: insertMock,
          delete: deleteMock,
        };
      }
      return {};
    });
    return { fromMock, insertMock, deleteEqMock, deleteMock, selectMock, singleMock };
  },
);

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { addTradeFavorite, removeTradeFavorite } from "./marketplace-write";

describe("marketplace-write", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockImplementation(() => ({ select: selectMock }));
    selectMock.mockImplementation(() => ({ single: singleMock }));
    deleteMock.mockImplementation(() => ({ eq: deleteEqMock }));
  });

  it("add inserts into trade_favorites with exact payload", async () => {
    singleMock.mockResolvedValue({
      data: {
        id: "fav-1",
        user_id: "user-a",
        tradesperson_id: "tp-1",
        created_at: "2026-01-01T00:00:00.000Z",
      },
      error: null,
    });

    const result = await addTradeFavorite({ userId: "user-a", tradespersonId: "tp-1" });

    expect(fromMock).toHaveBeenCalledWith("trade_favorites");
    expect(insertMock).toHaveBeenCalledWith({
      user_id: "user-a",
      tradesperson_id: "tp-1",
    });
    expect(result).toEqual({
      id: "fav-1",
      userId: "user-a",
      tradespersonId: "tp-1",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("add throws on Supabase error", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { message: "duplicate key" },
    });

    await expect(addTradeFavorite({ userId: "user-a", tradespersonId: "tp-1" })).rejects.toThrow(
      "duplicate key",
    );
  });

  it("add rejects empty userId before IO", async () => {
    await expect(addTradeFavorite({ userId: "  ", tradespersonId: "tp-1" })).rejects.toThrow(
      "userId is required",
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("add rejects empty tradespersonId before IO", async () => {
    await expect(addTradeFavorite({ userId: "user-a", tradespersonId: "" })).rejects.toThrow(
      "tradespersonId is required",
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("remove deletes by favorite row id", async () => {
    deleteEqMock.mockResolvedValue({ error: null });

    await removeTradeFavorite({ favoriteId: "fav-9" });

    expect(fromMock).toHaveBeenCalledWith("trade_favorites");
    expect(deleteMock).toHaveBeenCalled();
    expect(deleteEqMock).toHaveBeenCalledWith("id", "fav-9");
  });

  it("remove treats zero-row delete as success when no error", async () => {
    deleteEqMock.mockResolvedValue({ error: null, count: 0 });
    await expect(removeTradeFavorite({ favoriteId: "missing" })).resolves.toBeUndefined();
  });

  it("remove throws on Supabase error", async () => {
    deleteEqMock.mockResolvedValue({ error: { message: "rls denied" } });
    await expect(removeTradeFavorite({ favoriteId: "fav-1" })).rejects.toThrow("rls denied");
  });

  it("remove rejects empty favoriteId before IO", async () => {
    await expect(removeTradeFavorite({ favoriteId: " " })).rejects.toThrow(
      "favoriteId is required",
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("module source has no React or React Query dependency", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/marketplace-write.ts"), "utf8");
    expect(src).not.toMatch(/from\s+["']react["']/);
    expect(src).not.toMatch(/@tanstack\/react-query/);
    expect(src).not.toMatch(/useMutation|useQuery/);
  });
});
