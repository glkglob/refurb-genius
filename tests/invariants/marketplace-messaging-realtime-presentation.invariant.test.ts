/**
 * AO-1B3.2 — MessagingInbox must not own trade_messages Realtime lifecycle.
 *
 * Strength: lexical (comment-stripped source scan). Known bypasses: alias
 * reassignment of a Supabase client imported under another name, dynamic
 * import strings split across concatenations, unusual chained syntax.
 *
 * Distinguishes:
 *   write    → marketplace-write.ts
 *   read     → queries/marketplace.ts
 *   Realtime → useTradeMessagesRealtime.ts
 *
 * Does NOT claim all presentation infrastructure is removed app-wide.
 * Does NOT ban legitimate send/read presentation hooks.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const INBOX = "src/components/marketplace/MessagingInbox.tsx";
const REALTIME_HOOK = "src/features/marketplace/presentation/hooks/useTradeMessagesRealtime.ts";
const WRITE_MODULE = "src/lib/marketplace-write.ts";
const READ_MODULE = "src/lib/queries/marketplace.ts";

function stripLineComments(line: string): string {
  const idx = line.indexOf("//");
  if (idx === -1) return line;
  const before = line.slice(0, idx);
  if (before.endsWith(":")) return line;
  return before;
}

function stripAllComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map(stripLineComments)
    .join("\n");
}

function listTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const ents = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of ents) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFiles(full));
    } else if (
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      files.push(full);
    }
  }
  return files;
}

function relPath(file: string): string {
  return relative(ROOT, file).replace(/\\/g, "/");
}

/** True when content appears to own trade_messages Realtime channel lifecycle. */
function ownsTradeMessagesRealtimeLifecycle(content: string): boolean {
  const hasChannel = /\.channel\s*\(/.test(content) || /\bremoveChannel\s*\(/.test(content);
  const hasPostgresChanges = /postgres_changes/.test(content);
  const hasTradeMessagesTable =
    /["']trade_messages["']/.test(content) || /trade_messages/.test(content);
  const hasTradeMessagesChannelName = /trade-messages-/.test(content);

  if (!hasChannel && !hasPostgresChanges) return false;
  if (hasTradeMessagesChannelName) return true;
  if (hasPostgresChanges && hasTradeMessagesTable) return true;
  if (hasChannel && hasTradeMessagesTable) return true;
  return false;
}

test("marketplace messaging realtime — MessagingInbox calls useTradeMessagesRealtime", () => {
  const full = join(ROOT, INBOX);
  assert.ok(existsSync(full), `missing ${INBOX}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(
    text,
    /useTradeMessagesRealtime\s*\(/,
    `${INBOX} must call useTradeMessagesRealtime(`,
  );
});

test("marketplace messaging realtime — MessagingInbox bans direct Supabase and channel lifecycle", () => {
  const full = join(ROOT, INBOX);
  const text = stripAllComments(readFileSync(full, "utf8"));

  assert.doesNotMatch(
    text,
    /@\/platform\/supabase\/browser/,
    `${INBOX} must not import @/platform/supabase/browser`,
  );
  assert.doesNotMatch(text, /@\/platform\/supabase/, `${INBOX} must not import platform supabase`);
  assert.doesNotMatch(text, /\.channel\s*\(/, `${INBOX} must not call .channel(`);
  assert.doesNotMatch(text, /\bremoveChannel\s*\(/, `${INBOX} must not call removeChannel(`);
  assert.doesNotMatch(text, /postgres_changes/, `${INBOX} must not reference postgres_changes`);
  assert.doesNotMatch(text, /useQueryClient\s*\(/, `${INBOX} must not call useQueryClient(`);
  assert.doesNotMatch(
    text,
    /invalidateQueries\s*\(/,
    `${INBOX} must not own invalidateQueries after Realtime extraction`,
  );
});

test("marketplace messaging realtime — MessagingInbox retains send and read presentation", () => {
  const full = join(ROOT, INBOX);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /useSendTradeMessage\s*\(/);
  assert.match(text, /resolveTradeMessageRecipient\s*\(/);
  assert.match(text, /useAuth\s*\(/);
  assert.match(text, /tradeMessagesQueryOptions/);
  assert.match(text, /quoteRequestsByProjectQueryOptions/);
  assert.match(text, /useQuery\s*\(/);
});

test("marketplace messaging realtime — canonical hook owns channel lifecycle", () => {
  const full = join(ROOT, REALTIME_HOOK);
  assert.ok(existsSync(full), `missing ${REALTIME_HOOK}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /export\s+function\s+useTradeMessagesRealtime/);
  assert.match(text, /trade-messages-\$/);
  assert.match(text, /postgres_changes/);
  assert.match(text, /trade_messages/);
  assert.match(text, /removeChannel/);
  assert.match(text, /messagesByQuote/);
  assert.match(text, /selectedQuoteId/);
  assert.doesNotMatch(text, /sendTradeMessage/);
  assert.doesNotMatch(text, /useSendTradeMessage/);
  assert.doesNotMatch(text, /useMutation/);
  assert.doesNotMatch(text, /tradeMessagesQueryOptions/);
});

test("marketplace messaging realtime — production channel lifecycle limited to canonical hook", () => {
  const scanRoots = [
    join(ROOT, "src/components"),
    join(ROOT, "src/routes"),
    join(ROOT, "src/features"),
    join(ROOT, "src/lib"),
    join(ROOT, "src/hooks"),
  ];
  const violations: string[] = [];

  for (const root of scanRoots) {
    for (const file of listTsFiles(root)) {
      const rel = relPath(file);
      if (rel === REALTIME_HOOK) continue;
      if (rel === WRITE_MODULE) continue;
      if (rel === READ_MODULE) continue;
      const text = stripAllComments(readFileSync(file, "utf8"));
      if (ownsTradeMessagesRealtimeLifecycle(text)) {
        violations.push(`${rel} owns trade_messages Realtime lifecycle; use ${REALTIME_HOOK}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `trade_messages Realtime channel lifecycle outside ${REALTIME_HOOK}:\n${violations.join("\n")}`,
  );
});

test("marketplace messaging realtime — probe: channel in MessagingInbox is forbidden", () => {
  const sample = `supabase.channel("trade-messages");`;
  assert.match(sample, /\.channel\s*\(/);
});

test("marketplace messaging realtime — probe: removeChannel in MessagingInbox is forbidden", () => {
  const sample = `supabase.removeChannel(channel);`;
  assert.match(sample, /\bremoveChannel\s*\(/);
});

test("marketplace messaging realtime — probe: useQueryClient in MessagingInbox is forbidden", () => {
  const sample = `const qc = useQueryClient();`;
  assert.match(sample, /useQueryClient\s*\(/);
});

test("marketplace messaging realtime — probe: string-only hook name does not satisfy call", () => {
  const sample = `const useTradeMessagesRealtime = "fake";`;
  assert.doesNotMatch(sample, /useTradeMessagesRealtime\s*\(/);
});

test("marketplace messaging realtime — probe: legitimate send/read hooks remain allowed patterns", () => {
  const sample = `
useSendTradeMessage(userId);
resolveTradeMessageRecipient(input);
tradeMessagesQueryOptions(id);
quoteRequestsByProjectQueryOptions(projectId);
`;
  assert.match(sample, /useSendTradeMessage\s*\(/);
  assert.match(sample, /resolveTradeMessageRecipient\s*\(/);
  assert.match(sample, /tradeMessagesQueryOptions/);
  assert.doesNotMatch(sample, /\.channel\s*\(/);
  assert.doesNotMatch(sample, /postgres_changes/);
});
