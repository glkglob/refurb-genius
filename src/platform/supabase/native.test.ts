/**
 * Native Supabase client + PKCE SecureStorage proof (IOS-READINESS-2B-2).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const isNativePlatform = vi.fn();
const createClient = vi.fn();
const assertSupabaseEnv = vi.fn();
const createNativeAuthSecureStorage = vi.fn();

const secureStore = new Map<string, string>();
const secureAdapter = {
  getItem: vi.fn(async (key: string) => secureStore.get(key) ?? null),
  setItem: vi.fn(async (key: string, value: string) => {
    secureStore.set(key, value);
  }),
  removeItem: vi.fn(async (key: string) => {
    secureStore.delete(key);
  }),
};

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("@supabase/supabase-js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@supabase/supabase-js")>();
  return {
    ...actual,
    createClient: (...args: unknown[]) => createClient(...args),
  };
});

vi.mock("@repo/supabase/env", () => ({
  assertSupabaseEnv: () => assertSupabaseEnv(),
}));

vi.mock("@/platform/auth/native/pkce-storage", () => ({
  createNativeAuthSecureStorage: () => createNativeAuthSecureStorage(),
}));

const SRC = join(__dirname, "native.ts");

beforeEach(() => {
  vi.resetModules();
  isNativePlatform.mockReset();
  createClient.mockReset();
  assertSupabaseEnv.mockReset();
  createNativeAuthSecureStorage.mockReset();
  secureStore.clear();
  secureAdapter.getItem.mockClear();
  secureAdapter.setItem.mockClear();
  secureAdapter.removeItem.mockClear();

  isNativePlatform.mockReturnValue(true);
  assertSupabaseEnv.mockReturnValue({
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon-public-key",
  });
  createNativeAuthSecureStorage.mockReturnValue(secureAdapter);
  createClient.mockReturnValue({ auth: {} });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getNativeSupabase", () => {
  it("throws when not on a native platform", async () => {
    isNativePlatform.mockReturnValue(false);
    const { getNativeSupabase } = await import("./native");
    expect(() => getNativeSupabase()).toThrow(
      /Native Supabase client is only available on native platforms/,
    );
    expect(createClient).not.toHaveBeenCalled();
  });

  it("creates a client with public credentials and frozen PKCE auth config", async () => {
    const { getNativeSupabase, NATIVE_SUPABASE_STORAGE_KEY } = await import("./native");
    const client = getNativeSupabase();

    expect(assertSupabaseEnv).toHaveBeenCalledTimes(1);
    expect(createNativeAuthSecureStorage).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith("https://example.supabase.co", "anon-public-key", {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: false,
        storageKey: NATIVE_SUPABASE_STORAGE_KEY,
        storage: secureAdapter,
      },
    });
    expect(NATIVE_SUPABASE_STORAGE_KEY).toBe("rg-native-auth");
    expect(client).toBeDefined();
  });

  it("returns a lazy singleton on repeated calls", async () => {
    const { getNativeSupabase } = await import("./native");
    const a = getNativeSupabase();
    const b = getNativeSupabase();
    expect(a).toBe(b);
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it("never imports browser or _client cookie authority", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).not.toMatch(/platform\/supabase\/browser|from ["']\.\/browser["']/);
    expect(src).not.toMatch(/platform\/supabase\/_client|from ["']\.\/_client["']/);
    expect(src).not.toMatch(/pip-auth|createBrowserSupabase/);
    expect(src).not.toMatch(/service.?role|SERVICE_ROLE/i);
    expect(src).toMatch(/persistSession:\s*true/);
    expect(src).toMatch(/autoRefreshToken:\s*false/);
    expect(src).toMatch(/flowType:\s*["']pkce["']/);
    expect(src).toMatch(/storageKey:\s*NATIVE_SUPABASE_STORAGE_KEY/);
  });
});

describe("PKCE proof — SecureStorage adapter receives code-verifier", () => {
  it("writes rg-native-auth-code-verifier through the supplied secure adapter", async () => {
    // Use real createClient so auth-js PKCE path hits SupportedStorage.setItem.
    const actual =
      await vi.importActual<typeof import("@supabase/supabase-js")>("@supabase/supabase-js");
    createClient.mockImplementation(((...args: Parameters<typeof actual.createClient>) =>
      actual.createClient(...args)) as typeof actual.createClient);

    const { getNativeSupabase, NATIVE_SUPABASE_STORAGE_KEY } = await import("./native");
    const client = getNativeSupabase();

    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "com.refurbgenius.app://auth/callback",
        skipBrowserRedirect: true,
      },
    });

    expect(error).toBeNull();
    expect(data.url).toBeTruthy();
    expect(data.url).toMatch(/^https:\/\/example\.supabase\.co\/auth\/v1\/authorize/);

    const verifierKey = `${NATIVE_SUPABASE_STORAGE_KEY}-code-verifier`;
    expect(secureAdapter.setItem).toHaveBeenCalled();
    const wroteVerifier = secureAdapter.setItem.mock.calls.some(
      (call: unknown[]) =>
        call[0] === verifierKey && typeof call[1] === "string" && call[1].length > 0,
    );
    expect(wroteVerifier).toBe(true);

    // Same adapter + storageKey can read the verifier back (value not asserted in output).
    const stored = await secureAdapter.getItem(verifierKey);
    expect(typeof stored).toBe("string");
    expect(stored && stored.length > 0).toBe(true);
    expect(secureStore.has(verifierKey)).toBe(true);

    // No session was created by initiation alone.
    const sessionResult = await client.auth.getSession();
    expect(sessionResult.data.session).toBeNull();
  });

  it("does not use custom storage when persistSession would be false (contract guard)", () => {
    // Documented auth-js 2.105.4 behaviour: persistSession false forces memory adapter.
    // Our source must keep persistSession true so SecureStorage is used.
    const src = readFileSync(SRC, "utf8");
    expect(src).toMatch(/persistSession:\s*true/);
    expect(src).not.toMatch(/persistSession:\s*false/);
  });
});
