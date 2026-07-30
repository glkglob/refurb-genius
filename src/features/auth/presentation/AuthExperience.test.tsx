/**
 * AO-1E1.1 / AO-1E1.2 / AO-1E1.3 — AuthExperience presentation contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const signInWithPassword = vi.fn();
const signUpWithPassword = vi.fn();
const startGoogleOAuth = vi.fn();
const startAppleOAuth = vi.fn();
const startGitHubOAuth = vi.fn();
const sendMagicLink = vi.fn();
const requestPasswordReset = vi.fn();
const updatePassword = vi.fn();
const navigate = vi.fn();
const toastSuccess = vi.fn();
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
    startGitHubOAuth: (...args: unknown[]) => startGitHubOAuth(...args),
  }),
}));

vi.mock("./hooks/useAuthEmailAccess", () => ({
  useAuthEmailAccess: () => ({
    sendMagicLink: (...args: unknown[]) => sendMagicLink(...args),
    requestPasswordReset: (...args: unknown[]) => requestPasswordReset(...args),
    updatePassword: (...args: unknown[]) => updatePassword(...args),
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

import { AuthExperience } from "./AuthExperience";

const SRC = join(__dirname, "AuthExperience.tsx");

beforeEach(() => {
  signInWithPassword.mockReset();
  signUpWithPassword.mockReset();
  startGoogleOAuth.mockReset();
  startAppleOAuth.mockReset();
  startGitHubOAuth.mockReset();
  sendMagicLink.mockReset();
  requestPasswordReset.mockReset();
  updatePassword.mockReset();
  navigate.mockReset();
  toastSuccess.mockReset();
  loggerError.mockReset();
  signInWithPassword.mockResolvedValue(undefined);
  signUpWithPassword.mockResolvedValue("session");
  startGoogleOAuth.mockResolvedValue(undefined);
  startAppleOAuth.mockResolvedValue(undefined);
  startGitHubOAuth.mockResolvedValue(undefined);
  sendMagicLink.mockResolvedValue(undefined);
  requestPasswordReset.mockResolvedValue(undefined);
  updatePassword.mockResolvedValue(undefined);
  navigate.mockResolvedValue(undefined);
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

  it("renders Continue with GitHub in sign-in and signup modes", () => {
    const { unmount } = render(
      createElement(AuthExperience, { initialMode: "signin", redirect: "/projects" }),
    );
    expect(screen.getByRole("button", { name: /continue with github/i })).toBeTruthy();
    unmount();

    render(createElement(AuthExperience, { initialMode: "signup", redirect: "/projects" }));
    expect(screen.getByRole("button", { name: /continue with github/i })).toBeTruthy();
  });

  it("omits Continue with GitHub in reset mode", () => {
    render(createElement(AuthExperience, { initialMode: "reset" }));
    expect(screen.queryByRole("button", { name: /continue with github/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /continue with google/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /continue with apple/i })).toBeNull();
  });

  it("calls startGitHubOAuth with redirect and leaves loading on success", async () => {
    let resolveOAuth!: () => void;
    startGitHubOAuth.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveOAuth = resolve;
        }),
    );

    render(createElement(AuthExperience, { initialMode: "signin", redirect: "/projects" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: /continue with github/i,
      }),
    );

    await waitFor(() => {
      expect(startGitHubOAuth).toHaveBeenCalledWith("/projects");
    });
    expect(screen.getByText(/connecting to github/i)).toBeTruthy();

    resolveOAuth();
    await waitFor(() => {
      expect(startGitHubOAuth).toHaveBeenCalledTimes(1);
    });
    // Success leaves githubLoading true (no failure path) — spinner remains until unmount/redirect.
    expect(screen.getByText(/connecting to github/i)).toBeTruthy();
    expect(loggerError).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("GitHub pending disables competing auth actions and blocks double submit", async () => {
    let resolveOAuth!: () => void;
    startGitHubOAuth.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveOAuth = resolve;
        }),
    );

    render(createElement(AuthExperience, { initialMode: "signin", redirect: "/projects" }));
    const github = screen.getByRole("button", { name: /continue with github/i });
    fireEvent.click(github);

    await waitFor(() => {
      expect(startGitHubOAuth).toHaveBeenCalledWith("/projects");
    });
    expect(screen.getByText(/connecting to github/i)).toBeTruthy();

    const google = screen.getByRole("button", { name: /continue with google/i });
    const apple = screen.getByRole("button", { name: /continue with apple/i });
    const magic = screen.getByRole("button", { name: /continue with magic link/i });
    const submit = document.querySelector('form button[type="submit"]') as HTMLButtonElement;
    const emailInput = document.getElementById("email") as HTMLInputElement;
    const passwordInput = document.getElementById("password") as HTMLInputElement;

    expect((github as HTMLButtonElement).disabled).toBe(true);
    expect((google as HTMLButtonElement).disabled).toBe(true);
    expect((apple as HTMLButtonElement).disabled).toBe(true);
    expect((magic as HTMLButtonElement).disabled).toBe(true);
    expect(submit.disabled).toBe(true);
    expect(emailInput.disabled).toBe(true);
    expect(passwordInput.disabled).toBe(true);

    fireEvent.click(github);
    expect(startGitHubOAuth).toHaveBeenCalledTimes(1);

    resolveOAuth();
  });

  it("clears GitHub loading and shows error copy on failure", async () => {
    startGitHubOAuth.mockRejectedValue(new Error("GitHub authorization failed"));
    render(createElement(AuthExperience, { initialMode: "signin", redirect: "/projects" }));
    fireEvent.click(screen.getByRole("button", { name: /continue with github/i }));

    await waitFor(() => {
      expect(screen.getByText("GitHub authorization failed")).toBeTruthy();
    });
    expect(loggerError).toHaveBeenCalledWith("[auth] GitHub OAuth failed", {
      error: "Error: GitHub authorization failed",
    });
    expect(screen.getByRole("button", { name: /continue with github/i })).toBeTruthy();
    expect(screen.queryByText(/connecting to github/i)).toBeNull();
    expect(
      (screen.getByRole("button", { name: /continue with github/i }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(startGitHubOAuth).toHaveBeenCalledTimes(1);
  });
});

describe("AuthExperience — email access presentation (AO-1E1.3)", () => {
  it("calls sendMagicLink with email and redirect; toasts and clears loading", async () => {
    render(createElement(AuthExperience, { initialMode: "signin", redirect: "/projects" }));
    fireEvent.change(document.getElementById("email") as HTMLInputElement, {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue with magic link/i }));

    await waitFor(() => {
      expect(sendMagicLink).toHaveBeenCalledWith("user@example.com", "/projects");
    });
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Magic link sent. Check your inbox.");
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /continue with magic link/i })).toBeTruthy();
  });

  it("validates empty email for magic link without calling the hook", async () => {
    render(createElement(AuthExperience, { initialMode: "signin" }));
    fireEvent.click(screen.getByRole("button", { name: /continue with magic link/i }));

    await waitFor(() => {
      expect(screen.getByText("Enter your email first to receive a magic link.")).toBeTruthy();
    });
    expect(sendMagicLink).not.toHaveBeenCalled();
  });

  it("clears magic loading and shows error on failure", async () => {
    sendMagicLink.mockRejectedValue(new Error("otp blocked"));
    render(createElement(AuthExperience, { initialMode: "signin" }));
    fireEvent.change(document.getElementById("email") as HTMLInputElement, {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue with magic link/i }));

    await waitFor(() => {
      expect(screen.getByText("otp blocked")).toBeTruthy();
    });
    expect(loggerError).toHaveBeenCalledWith("[auth] magic link failed", {
      error: "Error: otp blocked",
    });
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("calls requestPasswordReset and toasts on success", async () => {
    render(createElement(AuthExperience, { initialMode: "signin" }));
    fireEvent.change(document.getElementById("email") as HTMLInputElement, {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /forgot password/i }));

    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledWith("user@example.com");
    });
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Password reset email sent.");
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("updates password in reset mode and navigates to sign-in", async () => {
    render(createElement(AuthExperience, { initialMode: "reset", redirect: "/projects" }));
    const passwordInput = document.getElementById("password") as HTMLInputElement;
    expect(passwordInput).toBeTruthy();
    fireEvent.change(passwordInput, { target: { value: "new-secret-12" } });
    const confirmPasswordInput = document.getElementById("confirm-password") as HTMLInputElement;
    expect(confirmPasswordInput).toBeTruthy();
    fireEvent.change(confirmPasswordInput, { target: { value: "new-secret-12" } });
    submitAuthForm();

    await waitFor(() => {
      expect(updatePassword).toHaveBeenCalledWith("new-secret-12");
    });
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Password updated. Please sign in with your new credentials.",
      );
    });
    expect(navigate).toHaveBeenCalledWith({
      to: "/auth",
      search: { mode: "signin", redirect: "/projects" },
      replace: true,
    });
  });

  it("rejects mismatched reset passwords before calling updatePassword", async () => {
    render(createElement(AuthExperience, { initialMode: "reset" }));
    fireEvent.change(document.getElementById("password") as HTMLInputElement, {
      target: { value: "new-secret-12" },
    });
    fireEvent.change(document.getElementById("confirm-password") as HTMLInputElement, {
      target: { value: "different-secret" },
    });
    submitAuthForm();

    expect(await screen.findByText("Passwords do not match.")).toBeTruthy();
    expect(updatePassword).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("rejects short reset passwords before calling updatePassword", async () => {
    render(createElement(AuthExperience, { initialMode: "reset" }));
    fireEvent.change(document.getElementById("password") as HTMLInputElement, {
      target: { value: "short" },
    });
    fireEvent.change(document.getElementById("confirm-password") as HTMLInputElement, {
      target: { value: "short" },
    });
    submitAuthForm();

    expect(await screen.findByText("Password must be at least 6 characters.")).toBeTruthy();
    expect(updatePassword).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("AuthExperience — redesign presentation contracts", () => {
  it("signin mode does not render signup-only profile fields or terms", () => {
    render(createElement(AuthExperience, { initialMode: "signin" }));
    expect(document.getElementById("name")).toBeNull();
    expect(document.getElementById("company")).toBeNull();
    expect(document.getElementById("terms-consent")).toBeNull();
    expect(screen.queryByText(/optional profile details/i)).toBeNull();
  });

  it("signup mode renders optional profile section and terms links", () => {
    render(createElement(AuthExperience, { initialMode: "signup" }));
    expect(screen.getByText(/optional profile details/i)).toBeTruthy();
    expect(document.getElementById("name")).toBeTruthy();
    expect(document.getElementById("company")).toBeTruthy();
    const terms = screen.getByRole("link", { name: /^terms$/i });
    const privacy = screen.getByRole("link", { name: /privacy policy/i });
    expect(terms.getAttribute("href")).toBe("/terms");
    expect(privacy.getAttribute("href")).toBe("/privacy");
    expect(terms.getAttribute("target")).toBe("_blank");
    expect(privacy.getAttribute("rel")).toMatch(/noopener/);
  });

  it("terms label toggles checkbox; legal links do not", () => {
    render(createElement(AuthExperience, { initialMode: "signup" }));
    const checkbox = document.getElementById("terms-consent") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(screen.getByText(/i agree to the/i));
    expect(checkbox.checked).toBe(true);

    const terms = screen.getByRole("link", { name: /^terms$/i });
    const privacy = screen.getByRole("link", { name: /privacy policy/i });
    fireEvent.click(terms, { preventDefault: () => undefined });
    terms.addEventListener("click", (e) => e.preventDefault());
    privacy.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(terms);
    expect(checkbox.checked).toBe(true);
    fireEvent.click(privacy);
    expect(checkbox.checked).toBe(true);
  });

  it("native checkbox checked property tracks user interaction", () => {
    render(createElement(AuthExperience, { initialMode: "signup" }));
    const checkbox = document.getElementById("terms-consent") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it("reset mode omits OAuth alternatives and email field", () => {
    render(createElement(AuthExperience, { initialMode: "reset" }));
    expect(document.getElementById("email")).toBeNull();
    expect(screen.queryByRole("button", { name: /continue with google/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /continue with apple/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /continue with magic link/i })).toBeNull();
    expect(screen.getByRole("button", { name: /update password/i })).toBeTruthy();
  });

  it("header mode action switches sign-in/signup", async () => {
    render(createElement(AuthExperience, { initialMode: "signin", redirect: "/projects" }));
    const pageHeader = screen.getByRole("banner");
    const headerSignUp = within(pageHeader).getByRole("button", { name: /^sign up$/i });
    fireEvent.click(headerSignUp);
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({
        to: "/auth",
        search: { mode: "signup", redirect: "/projects" },
        replace: true,
      });
    });
  });

  it("mode toggle uses group and aria-pressed; preserves navigation args", async () => {
    render(createElement(AuthExperience, { initialMode: "signup", redirect: "/projects" }));
    const modeGroup = screen.getByRole("group", { name: /authentication mode/i });
    const signInButton = within(modeGroup).getByRole("button", { name: /^sign in$/i });
    const signUpButton = within(modeGroup).getByRole("button", { name: /^sign up$/i });
    expect(signUpButton.getAttribute("aria-pressed")).toBe("true");
    expect(signInButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(signInButton);
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({
        to: "/auth",
        search: { mode: "signin", redirect: "/projects" },
        replace: true,
      });
    });
  });

  it("Apple pending disables competing auth actions", async () => {
    let resolveOAuth!: () => void;
    startAppleOAuth.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveOAuth = resolve;
        }),
    );

    render(createElement(AuthExperience, { initialMode: "signin", redirect: "/projects" }));
    const apple = screen.getByRole("button", { name: /continue with apple/i });
    fireEvent.click(apple);

    await waitFor(() => {
      expect(startAppleOAuth).toHaveBeenCalledWith("/projects");
    });
    expect(screen.getByText(/connecting to apple/i)).toBeTruthy();

    const google = screen.getByRole("button", { name: /continue with google/i });
    const magic = screen.getByRole("button", { name: /continue with magic link/i });
    const submit = document.querySelector('form button[type="submit"]') as HTMLButtonElement;
    expect((apple as HTMLButtonElement).disabled).toBe(true);
    expect((google as HTMLButtonElement).disabled).toBe(true);
    expect((magic as HTMLButtonElement).disabled).toBe(true);
    expect(submit.disabled).toBe(true);

    fireEvent.click(apple);
    expect(startAppleOAuth).toHaveBeenCalledTimes(1);

    resolveOAuth();
  });

  it("verification state uses redesigned shell and product overview", async () => {
    signUpWithPassword.mockResolvedValue("awaiting_verification");
    render(createElement(AuthExperience, { initialMode: "signup" }));
    fillEmailPassword("verify@ex.com", "secret12");
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "secret12" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    submitAuthForm();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /check your email/i })).toBeTruthy();
    });
    expect(screen.getByRole("region", { name: /product overview/i })).toBeTruthy();
    expect(screen.getByRole("main")).toBeTruthy();
    expect(document.getElementById("main-content")).toBeTruthy();
  });

  it("form has one unambiguous submit action", () => {
    render(createElement(AuthExperience, { initialMode: "signin" }));
    const submits = document.querySelectorAll('form button[type="submit"]');
    expect(submits.length).toBe(1);
  });

  it("exposes product overview landmark and security note", () => {
    render(createElement(AuthExperience, { initialMode: "signin" }));
    expect(screen.getByRole("region", { name: /product overview/i })).toBeTruthy();
    expect(screen.getByText(/secure • protected by supabase/i)).toBeTruthy();
  });
});

describe("AuthExperience — source boundary (AO-1E1.1 / AO-1E1.2 / AO-1E1.3 progressive)", () => {
  it("uses password, OAuth, and email-access hooks; bans residual direct Auth", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).toMatch(/useAuthPasswordCredentials\s*\(/);
    expect(src).toMatch(/useOAuthSignIn\s*\(/);
    expect(src).toMatch(/useAuthEmailAccess\s*\(/);
    expect(src).not.toMatch(/signInWithPassword\s*\(\s*\{/);
    expect(src).not.toMatch(/\.signInWithPassword\s*\(/);
    expect(src).not.toMatch(/auth\.signUp\s*\(|\.signUp\s*\(\s*\{/);
    expect(src).not.toMatch(/AUTH_USER_QUERY_KEY|setQueryData|fromSupabaseUser/);
    expect(src).not.toMatch(/markNewUserOnboarding|identifyAnalyticsUser|trackSignupCompleted/);
    expect(src).not.toMatch(/signInWithOAuth|\.signInWithOAuth\s*\(/);
    expect(src).not.toMatch(/oauth_sign_in_initiated|trackEvent/);
    expect(src).not.toMatch(/signInWithOtp/);
    expect(src).not.toMatch(/resetPasswordForEmail/);
    expect(src).not.toMatch(/@\/platform\/supabase/);
    expect(src).not.toMatch(/from ["']@\/lib\/auth["']/);
  });
});
