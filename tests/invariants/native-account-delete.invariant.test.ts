/**
 * Prevents native Settings account deletion from regressing to an unguarded
 * cookie createServerFn path.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("settings account deletion uses the platform dispatcher, not deleteAccountServerFn", () => {
  const settings = read("src/routes/_authed/settings.tsx");
  assert.match(settings, /deleteAccountForClient/);
  assert.doesNotMatch(settings, /deleteAccountServerFn/);
  assert.doesNotMatch(settings, /7 business days/i);
});

test("native dispatcher never calls the cookie serverFn on native", () => {
  const dispatcher = read("src/features/account-deletion/presentation/deleteAccountForClient.ts");
  assert.match(dispatcher, /Capacitor\.isNativePlatform\(\)/);
  assert.match(dispatcher, /deleteAccountNative/);
  assert.match(dispatcher, /deleteAccountServerFn/);
  assert.match(dispatcher, /if \(Capacitor\.isNativePlatform\(\)\)/);
});

test("mobile API registers the Bearer account-delete path", () => {
  const api = read("src/platform/http/mobile-api.server.ts");
  assert.match(api, /MOBILE_ACCOUNT_DELETE_PATHNAME/);
  assert.match(api, /\/api\/mobile\/v1\/account\/delete/);
  assert.match(api, /handleMobileAccountDelete/);
});

test("authorised copy no longer promises seven-business-day deletion", () => {
  const support = read("src/routes/support.tsx");
  const auth = read("src/serverFns/auth.ts");
  assert.doesNotMatch(support, /7 business days/i);
  assert.doesNotMatch(auth, /7 business days/i);
  assert.doesNotMatch(auth, /support@refurbgenius\.info/);
});

test("server-only runner is not statically imported from client surfaces", () => {
  const dispatcher = read("src/features/account-deletion/presentation/deleteAccountForClient.ts");
  const settings = read("src/routes/_authed/settings.tsx");
  const native = read("src/platform/http/mobile-account-delete.ts");
  for (const src of [dispatcher, settings, native]) {
    assert.doesNotMatch(src, /executeAccountDeletion/);
    assert.doesNotMatch(src, /createServiceRoleSupabase/);
    assert.doesNotMatch(src, /SUPABASE_SERVICE_ROLE_KEY/);
  }
});
