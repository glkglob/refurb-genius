#!/usr/bin/env tsx
/**
 * Server-only bootstrap script.
 * Creates or updates an admin user in Supabase auth and sets their profile role to 'admin'.
 *
 * Usage:
 *   SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   ADMIN_EMAIL=<email> ADMIN_PASSWORD=<password> \
 *   npm run admin:bootstrap
 *
 * NEVER commit real credentials. Supply via environment variables or a local .env file
 * that is listed in .gitignore.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/integrations/supabase/types";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const missing = [
  ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
  ...(!SUPABASE_SERVICE_ROLE_KEY ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
  ...(!ADMIN_EMAIL ? ["ADMIN_EMAIL"] : []),
  ...(!ADMIN_PASSWORD ? ["ADMIN_PASSWORD"] : []),
];

if (missing.length) {
  console.error(`[bootstrap-admin] Missing required env var(s): ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
});

async function run() {
  // Look up any existing user with this email
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  const existing = listData.users.find((u) => u.email === ADMIN_EMAIL);
  let userId: string;

  if (existing) {
    console.log(
      `[bootstrap-admin] User ${ADMIN_EMAIL} exists (${existing.id}). Updating password…`,
    );
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: ADMIN_PASSWORD!,
    });
    if (error) throw error;
    userId = existing.id;
  } else {
    console.log(`[bootstrap-admin] Creating user ${ADMIN_EMAIL}…`);
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL!,
      password: ADMIN_PASSWORD!,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
  }

  // Upsert profile with role = 'admin'
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: userId, email: ADMIN_EMAIL, role: "admin" }, { onConflict: "id" });
  if (profileError) throw profileError;

  console.log(`[bootstrap-admin] ✓ ${ADMIN_EMAIL} (${userId}) → role: admin`);
}

run().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[bootstrap-admin] Failed: ${message}`);
  process.exit(1);
});
