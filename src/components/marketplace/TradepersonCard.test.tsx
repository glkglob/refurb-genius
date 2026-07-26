import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const mutate = vi.fn();
const toastError = vi.fn();
let mockUser: { id: string } | null = { id: "user-1" };
let mockIsPending = false;
let mockAuthLoading = false;
let mockHydrated = true;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: mockAuthLoading,
    isAuthenticated: !!mockUser,
    hydrated: mockHydrated,
  }),
}));

vi.mock("@/features/marketplace", () => ({
  useToggleTradeFavorite: () => ({
    mutate,
    isPending: mockIsPending,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
  },
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({ data: [] }),
  };
});

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { TradepersonCard } from "./TradepersonCard";

const tradesperson = {
  id: "tp-1",
  business_name: "Acme Plumbers",
  contact_name: "Alex",
  postcode: "SW1A",
  bio: "Reliable",
  rating: 4.5,
  review_count: 10,
  phone: "07000",
  email: "a@example.com",
};

function renderCard() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  const onRequestQuote = vi.fn();
  render(
    createElement(TradepersonCard, {
      tradesperson,
      onRequestQuote,
    }),
    { wrapper },
  );
  return { onRequestQuote };
}

beforeEach(() => {
  mutate.mockReset();
  toastError.mockReset();
  mockUser = { id: "user-1" };
  mockIsPending = false;
  mockAuthLoading = false;
  mockHydrated = true;
});

describe("TradepersonCard favorites presentation", () => {
  it("signed-out click shows Auth toast and does not mutate", () => {
    mockUser = null;
    renderCard();
    fireEvent.click(screen.getByLabelText("Add to favorites"));
    expect(toastError).toHaveBeenCalledWith("Please sign in to save favorites");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("auth still loading does not toast sign-in or mutate", () => {
    mockUser = null;
    mockAuthLoading = true;
    mockHydrated = false;
    renderCard();
    const btn = screen.getByLabelText("Add to favorites") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(toastError).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("signed-in click invokes toggle hook", () => {
    renderCard();
    fireEvent.click(screen.getByLabelText("Add to favorites"));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toMatchObject({
      userId: "user-1",
      tradespersonId: "tp-1",
      isFavorited: false,
    });
  });

  it("error callback shows existing failure toast", async () => {
    mutate.mockImplementation((_vars, opts?: { onError?: (e: Error) => void }) => {
      opts?.onError?.(new Error("fail"));
    });
    renderCard();
    fireEvent.click(screen.getByLabelText("Add to favorites"));
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Failed to update favorites");
    });
  });

  it("pending mutation disables the favorite button", () => {
    mockIsPending = true;
    renderCard();
    expect((screen.getByLabelText("Add to favorites") as HTMLButtonElement).disabled).toBe(true);
  });

  it("quote action remains available", () => {
    const { onRequestQuote } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: /Request Quote/i }));
    expect(onRequestQuote).toHaveBeenCalledWith("tp-1");
  });

  it("source has no Supabase or auth.getUser infrastructure", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/marketplace/TradepersonCard.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/@\/platform\/supabase|@supabase\//);
    expect(src).not.toMatch(/auth\.getUser/);
    expect(src).not.toMatch(/trade_favorites/);
    expect(src).toMatch(/useToggleTradeFavorite/);
  });
});
