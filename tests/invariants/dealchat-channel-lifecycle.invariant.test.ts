/**
 * Phase 11C C3 — DealChat channel lifecycle ownership.
 *
 * Deal Copilot presentation and routes must not own Supabase Realtime
 * lifecycle for deal_messages. Use:
 *   src/core/dealCopilot/realtime/useDealMessagesChannel.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const APPROVED_OWNER = "src/core/dealCopilot/realtime/useDealMessagesChannel.ts";

/** Presentation roots that must not own deal_messages Realtime lifecycle. */
const FORBIDDEN_ROOTS = [
  join(ROOT, "src/components/deal-copilot"),
  join(ROOT, "src/routes"),
] as const;

function listTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFiles(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

function isDealCopilotRoute(rel: string): boolean {
  return (
    rel.startsWith("src/routes/") &&
    (rel.includes("/deal-copilot/") || rel.includes("/deal-copilot."))
  );
}

function isForbiddenPresentationPath(rel: string): boolean {
  if (rel === "src/components/deal-copilot" || rel.startsWith("src/components/deal-copilot/")) {
    return true;
  }
  return isDealCopilotRoute(rel);
}

/**
 * True when content appears to own deal_messages Realtime channel lifecycle.
 * Requires channel subscription signals plus deal_messages / deal-messages identity
 * so unrelated presentation code is not rejected.
 */
function ownsDealMessagesRealtimeLifecycle(content: string): boolean {
  const hasChannel = /\.channel\s*\(/.test(content) || /\bremoveChannel\s*\(/.test(content);
  const hasPostgresChanges = /postgres_changes/.test(content);
  const hasDealMessagesTable =
    /["']deal_messages["']/.test(content) || /deal_messages/.test(content);
  const hasDealMessagesChannelName = /deal-messages-/.test(content);

  if (!hasChannel && !hasPostgresChanges) return false;
  if (hasDealMessagesChannelName) return true;
  if (hasPostgresChanges && hasDealMessagesTable) return true;
  if (hasChannel && hasDealMessagesTable) return true;
  return false;
}

test("dealchat channel lifecycle — presentation does not own deal_messages Realtime", () => {
  const violations: string[] = [];

  for (const root of FORBIDDEN_ROOTS) {
    for (const file of listTsFiles(root)) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      if (!isForbiddenPresentationPath(rel)) continue;

      const content = readFileSync(file, "utf8");
      if (ownsDealMessagesRealtimeLifecycle(content)) {
        violations.push(`${rel} owns DealChat Realtime lifecycle; use ${APPROVED_OWNER}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Deal Copilot presentation must not own deal_messages Realtime channel lifecycle:\n${violations.join("\n")}`,
  );
});

test("dealchat channel lifecycle — approved owner module exists and defines the hook", () => {
  const ownerPath = join(ROOT, APPROVED_OWNER);
  assert.ok(existsSync(ownerPath), `missing ${APPROVED_OWNER}`);
  const text = readFileSync(ownerPath, "utf8");
  assert.match(text, /export function useDealMessagesChannel/);
  assert.match(text, /deal-messages-\$/);
  assert.match(text, /postgres_changes/);
  assert.match(text, /deal_messages/);
  assert.match(text, /removeChannel/);
});
