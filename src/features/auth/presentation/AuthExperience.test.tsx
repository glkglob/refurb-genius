/**
 * AO-1E1.1 — AuthExperience password credential presentation contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const signInWithPassword = vi.fn();
const signUpWithPassword = vi.fn();
const navigate = vi.fn();
const toastSuccess = vi.fn();
const updatePassword = vi.fn();
const resetPasswordForEmail = vi.fn();
const signInWithOAuth = vi.fn();
const signInWithOtp = vi.fn();

vi.mock("./hooks/useAuthPasswordCredentials", () => ({
  useAuthPasswordCredentials: () => ({
    signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
    signUpWithPassword: (...args: unknown[]) => signUpWithPassword(...args),
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...rest
  }: {
    children?: React.ReactNode;
    to: string;
    [key: string]: unknown;
  }) => createElement("a", { href: typeof to === "string" ? to : "#", ...rest }, children),
  useNavigate: () => navigate,
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    updatePassword: (...args: unknown[]) => updatePassword(...args),
    resetPasswordForEmail: (...args: unknown[]) => resetPasswordForEmail(...args),
  },
}));

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    auth: {
      signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args),
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
    },
  },
}));

import { AuthExperience } from "./AuthExperience";

const SRC = join(__dirname, "AuthExperience.tsx");

beforeEach(() => {
  signInWithPassword.mockReset();
  signUpWithPassword.mockReset();
  navigate.mockReset();
  toastSuccess.mockReset();
  updatePassword.mockReset();
  resetPasswordForEmail.mockReset();
  signInWithOAuth.mockReset();
  signInWithOtp.mockReset();
  signInWithPassword.mockResolvedValue(undefined);
  signUpWithPassword.mockResolvedValue("session");
  navigate.mockResolvedValue(undefined);
  updatePassword.mockResolvedValue(undefined);
  resetPasswordForEmail.mockResolvedValue(undefined);
  signInWithOAuth.mockResolvedValue({ error: null });
  signInWithOtp.mockResolvedValue({ error: null });
});

function fillEmailPassword(email = "user@example.com", password = "secret12") {
  const emailInput = document.getElementById("email") as HTMLInputElement;
  const passwordInput = document.getElementById("password") as HTMLInputElement;
  expect(emailInput).toBeTruthy();
  expect(passwordInput).toBeTruthy();
  fireEvent.change(emailInput, { target: { value: email } });
  fireEvent.change(passwordInput, { target: { value: password } });
}

function submitAuthForm() {
  const form = document.querySelector("form");
  expect(form).toBeTruthy();
  fireEvent.submit(form!);
}

describe("AuthExperience — password sign-in", () => {
  it("calls useAuthPasswordCredentials.signInWithPassword with component state (no app-level transform)", async () => {
    render(createElement(AuthExperience, { initialMode: "signin" }));
    // Mixed-case email + spaced password: AuthExperience must not lower-case email
    // or trim password. (type=email inputs may strip outer email whitespace in DOM.)
    fillEmailPassword("User@Example.COM", "  pass  ");
    submitAuthForm();

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledTimes(1);
    });
    expect(signInWithPassword).toHaveBeenCalledWith("User@Example.COM", "  pass  ");
    expect(toastSuccess).toHaveBeenCalledWith("Signed in successfully.");
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard", replace: true });
  });

  it("respects safe redirect destinations", async () => {
    render(createElement(AuthExperience, { initialMode: "signin", redirect: "/projects" }));
    fillEmailPassword();
    submitAuthForm();

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/projects", replace: true });
    });
  });

  it("rejects redirects that start with /auth", async () => {
    render(createElement(AuthExperience, { initialMode: "signin", redirect: "/auth/callback" }));
    fillEmailPassword();
    submitAuthForm();

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/dashboard", replace: true });
    });
  });

  it("maps failed sign-in errors into lockout after MAX_ATTEMPTS", async () => {
    signInWithPassword.mockRejectedValue(new Error("Invalid login credentials"));
    render(createElement(AuthExperience, { initialMode: "signin" }));

    for (let i = 0; i < 3; i += 1) {
      fillEmailPassword();
      submitAuthForm();
      await waitFor(() => {
        expect(signInWithPassword).toHaveBeenCalledTimes(i + 1);
      });
    }

    await waitFor(() => {
      expect(screen.getByText(/too many failed attempts/i)).toBeTruthy();
    });
  });
});

describe("AuthExperience — password signup", () => {
  it("validates terms and password confirmation before calling hook", async () => {
    render(createElement(AuthExperience, { initialMode: "signup" }));
    fillEmailPassword();
    submitAuthForm();

    expect(signUpWithPassword).not.toHaveBeenCalled();
    expect(screen.getByText(/terms and privacy/i)).toBeTruthy();
  });

  it("passes trimmed metadata and navigates on session outcome", async () => {
    render(createElement(AuthExperience, { initialMode: "signup" }));
    fillEmailPassword("new@ex.com", "secret12");
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "secret12" },
    });
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "  Ada  " } });
    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: "  Co  " } });
    fireEvent.click(screen.getByRole("checkbox"));
    submitAuthForm();

    await waitFor(() => {
      expect(signUpWithPassword).toHaveBeenCalledWith({
        email: "new@ex.com",
        password: "secret12",
        fullName: "Ada",
        companyName: "Co",
      });
    });
    expect(toastSuccess).toHaveBeenCalledWith("Account created. Welcome to Refurb Genius.");
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard", replace: true });
  });

  it("shows verification card without navigation when awaiting_verification", async () => {
    signUpWithPassword.mockResolvedValue("awaiting_verification");
    render(createElement(AuthExperience, { initialMode: "signup" }));
    fillEmailPassword("verify@ex.com", "secret12");
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "secret12" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    submitAuthForm();

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeTruthy();
    });
    expect(toastSuccess).toHaveBeenCalledWith(
      "Account created. Check your inbox to verify your email.",
    );
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("AuthExperience — source boundary (AO-1E1.1 progressive)", () => {
  it("uses password credential hook and bans direct password Auth methods", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).toMatch(/useAuthPasswordCredentials\s*\(/);
    expect(src).not.toMatch(/signInWithPassword\s*\(\s*\{/);
    expect(src).not.toMatch(/\.signInWithPassword\s*\(/);
    expect(src).not.toMatch(/auth\.signUp\s*\(|\.signUp\s*\(\s*\{/);
    expect(src).not.toMatch(/AUTH_USER_QUERY_KEY|setQueryData|fromSupabaseUser/);
    expect(src).not.toMatch(/markNewUserOnboarding|identifyAnalyticsUser|trackSignupCompleted/);
    // Residual OAuth / OTP / recovery still allowed
    expect(src).toMatch(/signInWithOAuth/);
    expect(src).toMatch(/signInWithOtp/);
    expect(src).toMatch(/resetPasswordForEmail|updatePassword/);
  });
});
