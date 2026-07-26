import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const mutate = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();
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
  useCreateQuoteRequest: () => ({
    mutate,
    isPending: mockIsPending,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/components/marketplace/LabourRateGuide", () => ({
  LabourRateGuide: () => createElement("div", { "data-testid": "labour-rate-guide" }),
}));

import { QuoteRequestDialog } from "./QuoteRequestDialog";

function renderDialog(overrides: Partial<Parameters<typeof QuoteRequestDialog>[0]> = {}) {
  const onOpenChange = vi.fn();
  render(
    createElement(QuoteRequestDialog, {
      open: true,
      onOpenChange,
      tradespersonId: "tp-1",
      tradespersonName: "Acme Plumbers",
      projectId: "proj-12345678",
      ...overrides,
    }),
  );
  return { onOpenChange };
}

beforeEach(() => {
  mutate.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
  mockUser = { id: "user-1" };
  mockIsPending = false;
  mockAuthLoading = false;
  mockHydrated = true;
});

describe("QuoteRequestDialog presentation", () => {
  it("signed-out submit shows Failed to send request without mutating", () => {
    mockUser = null;
    renderDialog();
    fireEvent.change(screen.getByLabelText(/Message \/ Scope of work/i), {
      target: { value: "Need a quote" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send Quote Request/i }));
    expect(toastError).toHaveBeenCalledWith("Failed to send request", {
      description: "You must be signed in",
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("auth still loading disables submit and does not toast", () => {
    mockUser = null;
    mockAuthLoading = true;
    mockHydrated = false;
    renderDialog();
    fireEvent.change(screen.getByLabelText(/Message \/ Scope of work/i), {
      target: { value: "Need a quote" },
    });
    const submit = screen.getByRole("button", { name: /Send Quote Request/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(toastError).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("signed-in valid form invokes create hook with exact mapping", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText(/Message \/ Scope of work/i), {
      target: { value: "  Full kitchen  " },
    });
    fireEvent.change(screen.getByLabelText(/budget \/ target price/i), {
      target: { value: "4500" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send Quote Request/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({
      tradespersonId: "tp-1",
      projectId: "proj-12345678",
      title: "Quote request for Acme Plumbers",
      message: "Full kitchen",
      proposedPrice: 4500,
    });
  });

  it("empty message does not mutate", () => {
    renderDialog();
    const submit = screen.getByRole("button", { name: /Send Quote Request/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("empty optional price omits proposedPrice from mutation", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText(/Message \/ Scope of work/i), {
      target: { value: "Need a quote" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send Quote Request/i }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Need a quote",
        proposedPrice: undefined,
      }),
      expect.any(Object),
    );
  });

  it("pending mutation disables submit", () => {
    mockIsPending = true;
    renderDialog();
    fireEvent.change(screen.getByLabelText(/Message \/ Scope of work/i), {
      target: { value: "Need a quote" },
    });
    expect((screen.getByRole("button", { name: /Sending/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("success toast, form reset, and close", async () => {
    mutate.mockImplementation((_vars, opts?: { onSuccess?: () => void }) => {
      opts?.onSuccess?.();
    });
    const { onOpenChange } = renderDialog();
    fireEvent.change(screen.getByLabelText(/Message \/ Scope of work/i), {
      target: { value: "Need a quote" },
    });
    fireEvent.change(screen.getByLabelText(/budget \/ target price/i), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send Quote Request/i }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Quote request sent!", {
        description: "The tradesperson will be notified. Linked to your project.",
      });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect((screen.getByLabelText(/Message \/ Scope of work/i) as HTMLTextAreaElement).value).toBe(
      "",
    );
    expect((screen.getByLabelText(/budget \/ target price/i) as HTMLInputElement).value).toBe("");
  });

  it("error shows Failed to send request toast", async () => {
    mutate.mockImplementation((_vars, opts?: { onError?: (e: Error) => void }) => {
      opts?.onError?.(new Error("fk violation"));
    });
    renderDialog();
    fireEvent.change(screen.getByLabelText(/Message \/ Scope of work/i), {
      target: { value: "Need a quote" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send Quote Request/i }));
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Failed to send request", {
        description: "fk violation",
      });
    });
  });

  it("cancel closes dialog", () => {
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("source has no Supabase, auth.getUser, or quote_requests infrastructure", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/marketplace/QuoteRequestDialog.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/@\/platform\/supabase|@supabase\//);
    expect(src).not.toMatch(/auth\.getUser/);
    expect(src).not.toMatch(/quote_requests/);
    expect(src).not.toMatch(/useQueryClient|invalidateQueries/);
    expect(src).toMatch(/useCreateQuoteRequest/);
  });
});
