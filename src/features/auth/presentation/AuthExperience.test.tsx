/**
 * AO-1E1.1 / AO-1E1.2 — AuthExperience password and OAuth presentation contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const signInWithPassword = vi.fn();
const signUpWithPassword = vi.fn();
const startGoogleOAuth = vi.fn();
const startAppleOAuth = vi.fn();
const navigate = vi.fn();
const toastSuccess = vi.fn();
const updatePassword = vi.fn();
const resetPasswordForEmail = vi.fn();
const signInWithOtp = vi.fn();
const loggerError = vi.fn();

vi.mock("./hooks/useAuthPasswordCredentials", () => ({
  useAuthPasswordCredentials: () => ({
    signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
    signUpWithPassword: (...args: unknown[]) => signUpWithPassword(...args),
  }),
}));

vi.mock("./hooks/useOAuthSignIn", () => ({
  useOAuthSignIn: () => ({
    startGoogleOAuth: (...args: unknown[]) => startGoogleOAuth(...args),
    startAppleOAuth: (...args: unknown[]) => startAppleOAuth(...args),
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
  logger: {
    error: (...args: unknown[]) => loggerError(...args),
    info: vi.fn(),
    warn: vi.fn(),
  },
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
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
    },
  },
}));

import { AuthExperience } from "./AuthExperience";

const SRC = join(__dirname, "AuthExperience.tsx");

beforeEach(() => {
  signInWithPassword.mockReset();
  signUpWithPassword.mockReset();
  startGoogleOAuth.mockReset();
  startAppleOAuth.mockReset();
  navigate.mockReset();
  toastSuccess.mockReset();
  updatePassword.mockReset();
  resetPasswordForEmail.mockReset();
  signInWithOtp.mockReset();
  loggerError.mockReset();
  signInWithPassword.mockResolvedValue(undefined);
  signUpWithPassword.mockResolvedValue("session");
  startGoogleOAuth.mockResolvedValue(undefined);
  startAppleOAuth.mockResolvedValue(undefined);
  navigate.mockResolvedValue(undefined);
  updatePassword.mockResolvedValue(undefined);
  resetPasswordForEmail.mockResolvedValue(undefined);
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

describe("AuthExperience — OAuth presentation (AO-1E1.2)", () => {
  it("calls startGoogleOAuth with redirect and leaves loading on success", async () => {
    let resolveOAuth!: () => void;
    startGoogleOAuth.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveOAuth = resolve;
        }),
    );

    render(createElement(AuthExperience, { initialMode: "signin", redirect: "/projects" }));
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    await waitFor(() => {
      expect(startGoogleOAuth).toHaveBeenCalledWith("/projects");
    });
    expect(screen.getByText(/connecting to google/i)).toBeTruthy();

    resolveOAuth();
    await waitFor(() => {
      expect(startGoogleOAuth).toHaveBeenCalledTimes(1);
    });
    // Success leaves oauthLoading true (no failure path) — spinner remains until unmount/redirect.
    expect(screen.getByText(/connecting to google/i)).toBeTruthy();
    expect(loggerError).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("clears Google loading and shows error copy on failure", async () => {
    startGoogleOAuth.mockRejectedValue(new Error("provider blocked"));
    render(createElement(AuthExperience, { initialMode: "signin" }));
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    await waitFor(() => {
      expect(screen.getByText("provider blocked")).toBeTruthy();
    });
    expect(loggerError).toHaveBeenCalledWith("[auth] google auth failed", {
      error: "Error: provider blocked",
    });
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeTruthy();
  });

  it("calls startAppleOAuth and logs apple-specific failure", async () => {
    startAppleOAuth.mockRejectedValue(new Error("Apple denied"));
    render(createElement(AuthExperience, { initialMode: "signin", redirect: "/settings" }));
    fireEvent.click(screen.getByRole("button", { name: /continue with apple/i }));

    await waitFor(() => {
      expect(startAppleOAuth).toHaveBeenCalledWith("/settings");
    });
    await waitFor(() => {
      expect(screen.getByText("Apple denied")).toBeTruthy();
    });
    expect(loggerError).toHaveBeenCalledWith("[auth] apple auth failed", {
      error: "Error: Apple denied",
    });
  });
});

describe("AuthExperience — source boundary (AO-1E1.1 / AO-1E1.2 progressive)", () => {
  it("uses password and OAuth hooks; bans direct password and OAuth Auth methods", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).toMatch(/useAuthPasswordCredentials\s*\(/);
    expect(src).toMatch(/useOAuthSignIn\s*\(/);
    expect(src).not.toMatch(/signInWithPassword\s*\(\s*\{/);
    expect(src).not.toMatch(/\.signInWithPassword\s*\(/);
    expect(src).not.toMatch(/auth\.signUp\s*\(|\.signUp\s*\(\s*\{/);
    expect(src).not.toMatch(/AUTH_USER_QUERY_KEY|setQueryData|fromSupabaseUser/);
    expect(src).not.toMatch(/markNewUserOnboarding|identifyAnalyticsUser|trackSignupCompleted/);
    expect(src).not.toMatch(/signInWithOAuth|\.signInWithOAuth\s*\(/);
    expect(src).not.toMatch(/oauth_sign_in_initiated|trackEvent/);
    // Residual OTP / recovery still allowed
    expect(src).toMatch(/signInWithOtp/);
    expect(src).toMatch(/resetPasswordForEmail|updatePassword/);
  });
});
