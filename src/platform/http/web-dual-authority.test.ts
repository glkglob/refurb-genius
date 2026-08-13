/**
 * Dual-authority non-regression (IOS-READINESS-2C-1).
 * Web cookie / requireUser path must remain cookie-based.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../../..");

describe("web cookie authority non-regression", () => {
  it("requireUser still uses pip-auth server cookie client", () => {
    const authServer = readFileSync(join(ROOT, "src/serverFns/auth.server.ts"), "utf8");
    expect(authServer).toMatch(/cookieName:\s*["']pip-auth["']/);
    expect(authServer).toMatch(/export async function requireUser/);
    expect(authServer).toMatch(/createServerSupabase/);
    // Must not switch web requireUser to Bearer-only.
    expect(authServer).not.toMatch(/requireMobileBearer|parseBearerAuthorization/);
  });

  it("browser client still uses pip-auth cookies", () => {
    const client = readFileSync(join(ROOT, "src/platform/supabase/_client.ts"), "utf8");
    expect(client).toMatch(/cookieName:\s*["']pip-auth["']/);
  });

  it("native client remains Keychain-backed with autoRefreshToken false", () => {
    const native = readFileSync(join(ROOT, "src/platform/supabase/native.ts"), "utf8");
    expect(native).toMatch(/autoRefreshToken:\s*false/);
    expect(native).toMatch(/NATIVE_SUPABASE_STORAGE_KEY|rg-native-auth/);
    expect(native).toMatch(/createNativeAuthSecureStorage/);
  });

  it("createProjectServerFn remains cookie requireUser for web", () => {
    const projects = readFileSync(join(ROOT, "src/serverFns/projects.ts"), "utf8");
    expect(projects).toMatch(/requireUser/);
    expect(projects).toMatch(/createProjectServerFn/);
  });

  it("mobile API is isolated under /api/mobile and server.ts intercept", () => {
    const server = readFileSync(join(ROOT, "src/server.ts"), "utf8");
    expect(server).toMatch(/\/api\/mobile/);
    expect(server).toMatch(/handleMobileApiRequest/);
    expect(server).not.toMatch(/server\.url/);
  });
});
