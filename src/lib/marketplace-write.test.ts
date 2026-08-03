import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const {
  fromMock,
  insertMock,
  deleteEqMock,
  deleteMock,
  selectMock,
  singleMock,
  quoteInsertMock,
  messageInsertMock,
} = vi.hoisted(() => {
  const singleMock = vi.fn();
  const selectMock = vi.fn(() => ({ single: singleMock }));
  const insertMock = vi.fn(() => ({ select: selectMock }));
  const deleteEqMock = vi.fn();
  const deleteMock = vi.fn(() => ({ eq: deleteEqMock }));
  const quoteInsertMock = vi.fn();
  const messageInsertMock = vi.fn();
  const fromMock = vi.fn((table: string) => {
    if (table === "trade_favorites") {
      return {
        insert: insertMock,
        delete: deleteMock,
      };
    }
    if (table === "quote_requests") {
      return {
        insert: quoteInsertMock,
      };
    }
    if (table === "trade_messages") {
      return {
        insert: messageInsertMock,
      };
    }
    return {};
  });
  return {
    fromMock,
    insertMock,
    deleteEqMock,
    deleteMock,
    selectMock,
    singleMock,
    quoteInsertMock,
    messageInsertMock,
  };
});

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

import {
  addTradeFavorite,
  removeTradeFavorite,
  createQuoteRequest,
  sendTradeMessage,
} from "./marketplace-write";

describe("marketplace-write", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockImplementation(() => ({ select: selectMock }));
    selectMock.mockImplementation(() => ({ single: singleMock }));
    deleteMock.mockImplementation(() => ({ eq: deleteEqMock }));
    quoteInsertMock.mockResolvedValue({ error: null });
    messageInsertMock.mockResolvedValue({ error: null });
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

  describe("createQuoteRequest", () => {
    it("inserts into quote_requests with exact required payload", async () => {
      await createQuoteRequest({
        userId: "user-a",
        tradespersonId: "tp-1",
        projectId: "proj-1",
        title: "Quote request for Acme",
        message: "Full kitchen refit",
      });

      expect(fromMock).toHaveBeenCalledWith("quote_requests");
      expect(quoteInsertMock).toHaveBeenCalledWith([
        {
          user_id: "user-a",
          tradesperson_id: "tp-1",
          project_id: "proj-1",
          status: "pending",
          title: "Quote request for Acme",
          message: "Full kitchen refit",
        },
      ]);
      const payload = quoteInsertMock.mock.calls[0][0][0] as Record<string, unknown>;
      expect(payload).not.toHaveProperty("proposed_price");
    });

    it("preserves empty project_id string", async () => {
      await createQuoteRequest({
        userId: "user-a",
        tradespersonId: "tp-1",
        projectId: "",
        title: "Quote request for Acme",
        message: "Scope",
      });

      expect(quoteInsertMock).toHaveBeenCalledWith([
        expect.objectContaining({
          project_id: "",
          status: "pending",
        }),
      ]);
    });

    it("includes numeric proposed_price without pence conversion", async () => {
      await createQuoteRequest({
        userId: "user-a",
        tradespersonId: "tp-1",
        projectId: "proj-1",
        title: "Quote request for Acme",
        message: "Scope",
        proposedPrice: 4500.5,
      });

      expect(quoteInsertMock).toHaveBeenCalledWith([
        expect.objectContaining({
          proposed_price: 4500.5,
        }),
      ]);
    });

    it("rejects empty userId before IO", async () => {
      await expect(
        createQuoteRequest({
          userId: " ",
          tradespersonId: "tp-1",
          projectId: "",
          title: "T",
          message: "M",
        }),
      ).rejects.toThrow("userId is required");
      expect(fromMock).not.toHaveBeenCalled();
    });

    it("rejects empty tradespersonId before IO", async () => {
      await expect(
        createQuoteRequest({
          userId: "user-a",
          tradespersonId: "",
          projectId: "",
          title: "T",
          message: "M",
        }),
      ).rejects.toThrow("tradespersonId is required");
      expect(fromMock).not.toHaveBeenCalled();
    });

    it("rejects empty title before IO", async () => {
      await expect(
        createQuoteRequest({
          userId: "user-a",
          tradespersonId: "tp-1",
          projectId: "",
          title: "  ",
          message: "M",
        }),
      ).rejects.toThrow("title is required");
      expect(fromMock).not.toHaveBeenCalled();
    });

    it("rejects empty or whitespace-only message before IO", async () => {
      await expect(
        createQuoteRequest({
          userId: "user-a",
          tradespersonId: "tp-1",
          projectId: "",
          title: "T",
          message: "   ",
        }),
      ).rejects.toThrow("message is required");
      expect(fromMock).not.toHaveBeenCalled();
    });

    it("rejects non-finite proposedPrice before IO", async () => {
      await expect(
        createQuoteRequest({
          userId: "user-a",
          tradespersonId: "tp-1",
          projectId: "",
          title: "T",
          message: "M",
          proposedPrice: Number.NaN,
        }),
      ).rejects.toThrow("Proposed price must be a valid number");
      expect(fromMock).not.toHaveBeenCalled();
    });

    it("throws meaningful Error on Supabase failure", async () => {
      quoteInsertMock.mockResolvedValue({ error: { message: "fk violation" } });
      await expect(
        createQuoteRequest({
          userId: "user-a",
          tradespersonId: "tp-1",
          projectId: "proj-1",
          title: "T",
          message: "M",
        }),
      ).rejects.toThrow("fk violation");
    });
  });

  describe("sendTradeMessage", () => {
    it("inserts canonical trade_messages payload (content; no body/recipient_id)", async () => {
      await sendTradeMessage({
        quoteRequestId: "quote-1",
        senderId: "user-a",
        recipientId: "user-b",
        body: "Hello there",
      });

      expect(fromMock).toHaveBeenCalledWith("trade_messages");
      expect(messageInsertMock).toHaveBeenCalledWith({
        quote_request_id: "quote-1",
        sender_id: "user-a",
        content: "Hello there",
      });
      const payload = messageInsertMock.mock.calls[0][0] as Record<string, unknown>;
      expect(payload).not.toHaveProperty("body");
      expect(payload).not.toHaveProperty("recipient_id");
      expect(payload).not.toHaveProperty("project_id");
      expect(payload).not.toHaveProperty("read_at");
      expect(payload).not.toHaveProperty("created_at");
      expect(Object.keys(payload).sort()).toEqual(
        ["content", "quote_request_id", "sender_id"].sort(),
      );
    });

    it("trims body and maps to content before insert", async () => {
      await sendTradeMessage({
        quoteRequestId: "quote-1",
        senderId: "user-a",
        recipientId: "user-b",
        body: "  Hello  ",
      });

      expect(messageInsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Hello",
        }),
      );
    });

    it("rejects empty quoteRequestId before IO", async () => {
      await expect(
        sendTradeMessage({
          quoteRequestId: "  ",
          senderId: "user-a",
          recipientId: "user-b",
          body: "Hi",
        }),
      ).rejects.toThrow("quoteRequestId is required");
      expect(fromMock).not.toHaveBeenCalled();
    });

    it("rejects empty senderId before IO", async () => {
      await expect(
        sendTradeMessage({
          quoteRequestId: "quote-1",
          senderId: "",
          recipientId: "user-b",
          body: "Hi",
        }),
      ).rejects.toThrow("senderId is required");
      expect(fromMock).not.toHaveBeenCalled();
    });

    it("rejects empty recipientId before IO", async () => {
      await expect(
        sendTradeMessage({
          quoteRequestId: "quote-1",
          senderId: "user-a",
          recipientId: " ",
          body: "Hi",
        }),
      ).rejects.toThrow("recipientId is required");
      expect(fromMock).not.toHaveBeenCalled();
    });

    it("rejects empty or whitespace-only body before IO", async () => {
      await expect(
        sendTradeMessage({
          quoteRequestId: "quote-1",
          senderId: "user-a",
          recipientId: "user-b",
          body: "   ",
        }),
      ).rejects.toThrow("body is required");
      expect(fromMock).not.toHaveBeenCalled();
    });

    it("allows senderId equal to recipientId", async () => {
      await expect(
        sendTradeMessage({
          quoteRequestId: "quote-1",
          senderId: "user-a",
          recipientId: "user-a",
          body: "Self note",
        }),
      ).resolves.toBeUndefined();
      expect(messageInsertMock).toHaveBeenCalled();
    });

    it("performs no .select() and returns void", async () => {
      const result = await sendTradeMessage({
        quoteRequestId: "quote-1",
        senderId: "user-a",
        recipientId: "user-b",
        body: "Hi",
      });
      expect(result).toBeUndefined();
      // message insert mock is a plain fn — no select chain attached
      expect(messageInsertMock).toHaveBeenCalledTimes(1);
    });

    it("throws meaningful Error on Supabase failure", async () => {
      messageInsertMock.mockResolvedValue({ error: { message: "rls denied" } });
      await expect(
        sendTradeMessage({
          quoteRequestId: "quote-1",
          senderId: "user-a",
          recipientId: "user-b",
          body: "Hi",
        }),
      ).rejects.toThrow("rls denied");
    });
  });

  it("module source has no React, React Query, Auth, or Realtime dependency", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/marketplace-write.ts"), "utf8");
    expect(src).not.toMatch(/from\s+["']react["']/);
    expect(src).not.toMatch(/@tanstack\/react-query/);
    expect(src).not.toMatch(/useMutation|useQuery/);
    expect(src).not.toMatch(/@\/lib\/auth|auth\.getUser/);
    expect(src).not.toMatch(/\.channel\s*\(|postgres_changes|removeChannel/);
  });
});
