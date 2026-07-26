import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { marketplaceKeys } from "@/lib/queries/marketplace";

const invalidateQueries = vi.fn();
const setQueryData = vi.fn();
const loggerInfo = vi.fn();
const removeChannel = vi.fn();
const channelFn = vi.fn();

type ChannelObj = {
  id: string;
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
};

const channels: ChannelObj[] = [];
let lastOnArgsCaptured: {
  eventApi: string;
  filter: {
    event: string;
    schema: string;
    table: string;
    filter: string;
  };
  callback: () => void;
} | null = null;
let lastSubscribeStatusCb: ((status: string) => void) | null = null;

function makeChannel(): ChannelObj {
  const ch: ChannelObj = {
    id: `ch-${channels.length + 1}`,
    on: vi.fn(),
    subscribe: vi.fn(),
  };
  ch.on.mockImplementation((...args: unknown[]) => {
    lastOnArgsCaptured = {
      eventApi: args[0] as string,
      filter: args[1] as {
        event: string;
        schema: string;
        table: string;
        filter: string;
      },
      callback: args[2] as () => void,
    };
    return ch;
  });
  ch.subscribe.mockImplementation((...args: unknown[]) => {
    const statusCb = args[0] as ((status: string) => void) | undefined;
    if (statusCb) lastSubscribeStatusCb = statusCb;
    return ch;
  });
  channels.push(ch);
  return ch;
}

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries,
      setQueryData,
    }),
  };
});

vi.mock("@/lib/logger", () => ({
  logger: {
    info: (...args: unknown[]) => loggerInfo(...args),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    channel: (...args: unknown[]) => channelFn(...args),
    removeChannel: (...args: unknown[]) => removeChannel(...args),
  },
}));

import { useTradeMessagesRealtime } from "./useTradeMessagesRealtime";

const QUOTE_A = "quote-aaaa-bbbb-cccc-dddd";
const QUOTE_B = "quote-bbbb-cccc-dddd-eeee";

beforeEach(() => {
  invalidateQueries.mockReset();
  setQueryData.mockReset();
  loggerInfo.mockReset();
  removeChannel.mockReset();
  channelFn.mockReset();
  channels.length = 0;
  lastOnArgsCaptured = null;
  lastSubscribeStatusCb = null;

  channelFn.mockImplementation(() => makeChannel());
});

function lastOnArgs() {
  if (!lastOnArgsCaptured) throw new Error("no .on call captured");
  return lastOnArgsCaptured;
}

function getLastSubscribeStatusCb() {
  if (!lastSubscribeStatusCb) throw new Error("no subscribe status callback");
  return lastSubscribeStatusCb;
}

describe("useTradeMessagesRealtime", () => {
  it("undefined ID creates no channel", () => {
    renderHook(() => useTradeMessagesRealtime(undefined));
    expect(channelFn).not.toHaveBeenCalled();
    expect(lastOnArgsCaptured).toBeNull();
    expect(lastSubscribeStatusCb).toBeNull();
  });

  it("null ID creates no channel", () => {
    renderHook(() => useTradeMessagesRealtime(null));
    expect(channelFn).not.toHaveBeenCalled();
  });

  it("empty-string ID creates no channel", () => {
    renderHook(() => useTradeMessagesRealtime(""));
    expect(channelFn).not.toHaveBeenCalled();
  });

  it("valid ID creates exactly one channel with exact name and contract", () => {
    renderHook(() => useTradeMessagesRealtime(QUOTE_A));

    expect(channelFn).toHaveBeenCalledTimes(1);
    expect(channelFn).toHaveBeenCalledWith(`trade-messages-${QUOTE_A}`);
    expect(channels).toHaveLength(1);
    expect(channels[0].on).toHaveBeenCalledTimes(1);
    expect(channels[0].subscribe).toHaveBeenCalledTimes(1);

    const { eventApi, filter } = lastOnArgs();
    expect(eventApi).toBe("postgres_changes");
    expect(filter.event).toBe("INSERT");
    expect(filter.schema).toBe("public");
    expect(filter.table).toBe("trade_messages");
    expect(filter.filter).toBe(`quote_request_id=eq.${QUOTE_A}`);
  });

  it("callback invalidates exact messagesByQuote key only", () => {
    renderHook(() => useTradeMessagesRealtime(QUOTE_A));
    const { callback } = lastOnArgs();
    callback();

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: marketplaceKeys.messagesByQuote(QUOTE_A),
    });
    expect(setQueryData).not.toHaveBeenCalled();

    const key = (invalidateQueries.mock.calls[0][0] as { queryKey: unknown[] }).queryKey;
    expect(key).not.toEqual(marketplaceKeys.all);
    expect(key).not.toEqual(marketplaceKeys.messagesByQuote(QUOTE_B));
  });

  it("Quote A callback never invalidates Quote B", () => {
    renderHook(() => useTradeMessagesRealtime(QUOTE_A));
    const { callback } = lastOnArgs();
    callback();

    const key = (invalidateQueries.mock.calls[0][0] as { queryKey: unknown[] }).queryKey;
    expect(key).toEqual(marketplaceKeys.messagesByQuote(QUOTE_A));
    expect(JSON.stringify(key)).not.toContain(QUOTE_B);
  });

  it("SUBSCRIBED logs exactly once with exact message and metadata key", () => {
    renderHook(() => useTradeMessagesRealtime(QUOTE_A));
    const statusCb = getLastSubscribeStatusCb();

    statusCb("SUBSCRIBED");
    expect(loggerInfo).toHaveBeenCalledTimes(1);
    expect(loggerInfo).toHaveBeenCalledWith("[marketplace] realtime subscribed to messages", {
      selectedQuoteId: QUOTE_A,
    });

    statusCb("CHANNEL_ERROR");
    statusCb("TIMED_OUT");
    statusCb("CLOSED");
    expect(loggerInfo).toHaveBeenCalledTimes(1);
  });

  it("unmount removes the exact channel", () => {
    const { unmount } = renderHook(() => useTradeMessagesRealtime(QUOTE_A));
    const ch = channels[0];
    unmount();
    expect(removeChannel).toHaveBeenCalledTimes(1);
    expect(removeChannel).toHaveBeenCalledWith(ch);
  });

  it("quote change removes previous channel and creates next", () => {
    const { rerender } = renderHook(
      ({ id }: { id: string | null }) => useTradeMessagesRealtime(id),
      { initialProps: { id: QUOTE_A as string | null } },
    );

    expect(channelFn).toHaveBeenCalledWith(`trade-messages-${QUOTE_A}`);
    const first = channels[0];

    rerender({ id: QUOTE_B });
    expect(removeChannel).toHaveBeenCalledWith(first);
    expect(channelFn).toHaveBeenCalledWith(`trade-messages-${QUOTE_B}`);
    expect(channels).toHaveLength(2);

    const second = channels[1];
    expect(removeChannel).not.toHaveBeenCalledWith(second);
  });

  it("cleanup does not remove the wrong channel after switch", () => {
    const { rerender, unmount } = renderHook(
      ({ id }: { id: string | null }) => useTradeMessagesRealtime(id),
      { initialProps: { id: QUOTE_A as string | null } },
    );
    const first = channels[0];
    rerender({ id: QUOTE_B });
    const second = channels[1];
    removeChannel.mockClear();
    unmount();
    expect(removeChannel).toHaveBeenCalledTimes(1);
    expect(removeChannel).toHaveBeenCalledWith(second);
    expect(removeChannel).not.toHaveBeenCalledWith(first);
  });

  it("source owns no send primitive, send mutation, read query, optimistic update, or reconnect", () => {
    const src = readFileSync(
      join(
        process.cwd(),
        "src/features/marketplace/presentation/hooks/useTradeMessagesRealtime.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/sendTradeMessage/);
    expect(src).not.toMatch(/useSendTradeMessage/);
    expect(src).not.toMatch(/useMutation/);
    expect(src).not.toMatch(/tradeMessagesQueryOptions/);
    expect(src).not.toMatch(/useQuery\s*\(/);
    expect(src).not.toMatch(/setQueryData/);
    expect(src).not.toMatch(/reconnect|retry\s*:/i);
    expect(src).toMatch(/removeChannel/);
    expect(src).toMatch(/postgres_changes/);
  });
});
