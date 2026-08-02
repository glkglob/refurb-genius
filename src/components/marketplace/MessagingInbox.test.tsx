import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const mutate = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();
const loggerError = vi.fn();
const useTradeMessagesRealtime = vi.fn();

let mockUser: { id: string } | null = { id: "user-owner" };
let mockIsPending = false;
let mockAuthLoading = false;
let mockHydrated = true;

const QUOTE_OWNER = {
  id: "quote-aaaa-bbbb-cccc-dddd",
  user_id: "user-owner",
  tradesperson_id: "tp-profile-1",
  status: "pending",
  created_at: "2026-01-01T00:00:00.000Z",
  message: "Kitchen work",
  project_id: "proj-1",
  title: "Quote",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const QUOTE_OTHER = {
  ...QUOTE_OWNER,
  id: "quote-other-party-id-xx",
  user_id: "user-owner",
  tradesperson_id: "tp-profile-1",
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: mockAuthLoading,
    isAuthenticated: !!mockUser,
    hydrated: mockHydrated,
  }),
}));

vi.mock("@/features/marketplace", async () => {
  const actual =
    await vi.importActual<typeof import("@/features/marketplace")>("@/features/marketplace");
  return {
    ...actual,
    useSendTradeMessage: () => ({
      mutate,
      isPending: mockIsPending,
    }),
    useTradeMessagesRealtime: (...args: unknown[]) => useTradeMessagesRealtime(...args),
  };
});

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: (...args: unknown[]) => loggerError(...args),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

const quotesData: (typeof QUOTE_OWNER)[] = [];
const messagesData: Array<{
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}> = [];

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (opts: { queryKey?: unknown[]; enabled?: boolean }) => {
      const key = opts.queryKey as unknown[] | undefined;
      const isMessages = Array.isArray(key) && key.includes("messages");
      if (isMessages) {
        return {
          data: opts.enabled === false ? undefined : messagesData,
          isLoading: false,
        };
      }
      return {
        data: opts.enabled === false ? undefined : quotesData,
        isLoading: false,
      };
    },
  };
});

import { MessagingInbox } from "./MessagingInbox";

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

function renderInbox(projectId?: string) {
  return render(createElement(MessagingInbox, { projectId }), {
    wrapper: createWrapper(),
  });
}

beforeEach(() => {
  mutate.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
  loggerError.mockReset();
  useTradeMessagesRealtime.mockReset();
  mockUser = { id: "user-owner" };
  mockIsPending = false;
  mockAuthLoading = false;
  mockHydrated = true;
  quotesData.length = 0;
  messagesData.length = 0;
});

describe("MessagingInbox presentation", () => {
  it("projectId optional contract shows empty state without project", () => {
    renderInbox(undefined);
    expect(screen.getByText(/Link to a project from the Property Detail page/i)).toBeTruthy();
  });

  it("auth loading disables send without false error toast", () => {
    quotesData.push(QUOTE_OWNER);
    mockAuthLoading = true;
    mockHydrated = false;
    mockUser = null;
    renderInbox("proj-1");
    fireEvent.click(screen.getByText(/Quote #quote-aa/i));
    fireEvent.change(screen.getByPlaceholderText(/Type your reply/i), {
      target: { value: "Hello" },
    });
    const send = screen.getByRole("button", { name: /Send message/i }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.click(send);
    expect(toastError).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("signed-out send shows Failed to send message without mutating", () => {
    quotesData.push(QUOTE_OWNER);
    mockUser = null;
    renderInbox("proj-1");
    fireEvent.click(screen.getByText(/Quote #quote-aa/i));
    fireEvent.change(screen.getByPlaceholderText(/Type your reply/i), {
      target: { value: "Hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send message/i }));
    expect(toastError).toHaveBeenCalledWith("Failed to send message");
    expect(loggerError).toHaveBeenCalledWith("[marketplace] send message failed", {
      error: "You must be signed in",
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("blank message is a silent no-op", () => {
    quotesData.push(QUOTE_OWNER);
    renderInbox("proj-1");
    fireEvent.click(screen.getByText(/Quote #quote-aa/i));
    const send = screen.getByRole("button", { name: /Send message/i }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.click(send);
    expect(mutate).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("no selected quote does not offer send form", () => {
    quotesData.push(QUOTE_OWNER);
    renderInbox("proj-1");
    expect(screen.getByText(/Select a quote from the left/i)).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Type your reply/i)).toBeNull();
  });

  it("missing selected quote row triggers failure UX", () => {
    // Selected id from a prior list; current quotes empty after refresh.
    quotesData.push(QUOTE_OWNER);
    renderInbox("proj-1");
    fireEvent.click(screen.getByText(/Quote #quote-aa/i));
    quotesData.length = 0;
    fireEvent.change(screen.getByPlaceholderText(/Type your reply/i), {
      target: { value: "Still here" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send message/i }));
    expect(toastError).toHaveBeenCalledWith("Failed to send message");
    expect(loggerError).toHaveBeenCalledWith("[marketplace] send message failed", {
      error: "Quote not found",
    });
    expect(mutate).not.toHaveBeenCalled();
    expect((screen.getByPlaceholderText(/Type your reply/i) as HTMLInputElement).value).toBe(
      "Still here",
    );
  });

  it("requester/owner recipient resolves to quote.tradesperson_id", () => {
    quotesData.push(QUOTE_OWNER);
    mockUser = { id: "user-owner" };
    renderInbox("proj-1");
    fireEvent.click(screen.getByText(/Quote #quote-aa/i));
    fireEvent.change(screen.getByPlaceholderText(/Type your reply/i), {
      target: { value: "  Hello owner  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send message/i }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({
      quoteRequestId: QUOTE_OWNER.id,
      recipientId: "tp-profile-1",
      body: "Hello owner",
    });
    const input = mutate.mock.calls[0][0] as Record<string, unknown>;
    expect(input).not.toHaveProperty("senderId");
    expect(input).not.toHaveProperty("userId");
  });

  it("other participant recipient resolves to quote.user_id", () => {
    quotesData.push(QUOTE_OTHER);
    mockUser = { id: "user-tradesperson-auth" };
    renderInbox("proj-1");
    fireEvent.click(screen.getByText(/Quote #quote-ot/i));
    fireEvent.change(screen.getByPlaceholderText(/Type your reply/i), {
      target: { value: "Reply from trade" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send message/i }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteRequestId: QUOTE_OTHER.id,
        recipientId: "user-owner",
        body: "Reply from trade",
      }),
      expect.any(Object),
    );
  });

  it("pending disables input and send button", () => {
    quotesData.push(QUOTE_OWNER);
    mockIsPending = true;
    renderInbox("proj-1");
    fireEvent.click(screen.getByText(/Quote #quote-aa/i));
    fireEvent.change(screen.getByPlaceholderText(/Type your reply/i), {
      target: { value: "Hello" },
    });
    expect((screen.getByPlaceholderText(/Type your reply/i) as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole("button", { name: /Send message/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("success clears input and shows no success toast", async () => {
    quotesData.push(QUOTE_OWNER);
    mutate.mockImplementation((_vars, opts?: { onSuccess?: () => void }) => {
      opts?.onSuccess?.();
    });
    renderInbox("proj-1");
    fireEvent.click(screen.getByText(/Quote #quote-aa/i));
    fireEvent.change(screen.getByPlaceholderText(/Type your reply/i), {
      target: { value: "Hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send message/i }));
    await waitFor(() => {
      expect((screen.getByPlaceholderText(/Type your reply/i) as HTMLInputElement).value).toBe("");
    });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByText(/Conversation • quote-aa/i)).toBeTruthy();
  });

  it("failure preserves input and selection with exact error toast/log", async () => {
    quotesData.push(QUOTE_OWNER);
    mutate.mockImplementation((_vars, opts?: { onError?: (e: Error) => void }) => {
      opts?.onError?.(new Error("rls denied"));
    });
    renderInbox("proj-1");
    fireEvent.click(screen.getByText(/Quote #quote-aa/i));
    fireEvent.change(screen.getByPlaceholderText(/Type your reply/i), {
      target: { value: "Keep me" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send message/i }));
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Failed to send message");
    });
    expect(loggerError).toHaveBeenCalledWith("[marketplace] send message failed", {
      error: "rls denied",
    });
    expect((screen.getByPlaceholderText(/Type your reply/i) as HTMLInputElement).value).toBe(
      "Keep me",
    );
    expect(screen.getByText(/Conversation • quote-aa/i)).toBeTruthy();
  });

  it("calls useTradeMessagesRealtime with null then selected quote ID", () => {
    quotesData.push(QUOTE_OWNER);
    renderInbox("proj-1");
    expect(useTradeMessagesRealtime).toHaveBeenCalled();
    expect(useTradeMessagesRealtime.mock.calls[0][0]).toBe(null);

    fireEvent.click(screen.getByText(/Quote #quote-aa/i));
    const lastArg =
      useTradeMessagesRealtime.mock.calls[useTradeMessagesRealtime.mock.calls.length - 1][0];
    expect(lastArg).toBe(QUOTE_OWNER.id);
  });

  it("quote change updates useTradeMessagesRealtime argument", () => {
    quotesData.push(QUOTE_OWNER, QUOTE_OTHER);
    renderInbox("proj-1");
    fireEvent.click(screen.getByText(/Quote #quote-aa/i));
    expect(
      useTradeMessagesRealtime.mock.calls[useTradeMessagesRealtime.mock.calls.length - 1][0],
    ).toBe(QUOTE_OWNER.id);
    fireEvent.click(screen.getByText(/Quote #quote-ot/i));
    expect(
      useTradeMessagesRealtime.mock.calls[useTradeMessagesRealtime.mock.calls.length - 1][0],
    ).toBe(QUOTE_OTHER.id);
  });

  it("source uses Realtime hook and has no direct Supabase or QueryClient ownership", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/marketplace/MessagingInbox.tsx"),
      "utf8",
    );
    expect(src).toMatch(/useTradeMessagesRealtime\s*\(/);
    expect(src).toMatch(/useSendTradeMessage\s*\(/);
    expect(src).toMatch(/resolveTradeMessageRecipient\s*\(/);
    expect(src).toMatch(/useAuth\s*\(/);
    expect(src).not.toMatch(/auth\.getUser\s*\(/);
    expect(src).not.toMatch(/\.from\s*\(\s*["']trade_messages["']\s*\)[\s\S]{0,80}\.insert/);
    expect(src).not.toMatch(/\.channel\s*\(/);
    expect(src).not.toMatch(/postgres_changes/);
    expect(src).not.toMatch(/removeChannel/);
    expect(src).not.toMatch(/useQueryClient/);
    expect(src).not.toMatch(/@\/platform\/supabase\/browser/);
  });
});
