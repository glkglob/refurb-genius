/**
 * AO-1B3.1 — MessagingInbox must not own trade_messages send infrastructure.
 *
 * Strength: lexical (comment-stripped source scan). Known bypasses: alias
 * reassignment of a Supabase client imported under another name, dynamic
 * import strings split across concatenations, unusual chained syntax.
 *
 * Does NOT ban Supabase Realtime usage in MessagingInbox (deferred to AO-1B3.2).
 * Does NOT claim MessagingInbox is infrastructure-free.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const INBOX = "src/components/marketplace/MessagingInbox.tsx";
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

const FROM_TRADE_MESSAGES = /\.from\s*\(\s*["']trade_messages["']\s*\)/;
const INSERT_AFTER_FROM = /\.from\s*\(\s*["']trade_messages["']\s*\)[\s\S]{0,120}\.insert\s*\(/;

test("marketplace message send — MessagingInbox uses useSendTradeMessage", () => {
  const full = join(ROOT, INBOX);
  assert.ok(existsSync(full), `missing ${INBOX}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /useSendTradeMessage/, `${INBOX} must use useSendTradeMessage`);
  assert.match(text, /useSendTradeMessage\s*\(/, `${INBOX} must call useSendTradeMessage(`);
});

test("marketplace message send — MessagingInbox uses resolveTradeMessageRecipient", () => {
  const full = join(ROOT, INBOX);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(
    text,
    /resolveTradeMessageRecipient\s*\(/,
    `${INBOX} must call resolveTradeMessageRecipient(`,
  );
});

test("marketplace message send — MessagingInbox bans send-path Auth and insert", () => {
  const full = join(ROOT, INBOX);
  const text = stripAllComments(readFileSync(full, "utf8"));

  assert.doesNotMatch(text, /auth\.getUser\s*\(/, `${INBOX} must not call auth.getUser(`);
  assert.doesNotMatch(text, /@\/lib\/auth/, `${INBOX} must not import @/lib/auth`);
  assert.doesNotMatch(
    text,
    INSERT_AFTER_FROM,
    `${INBOX} must not chain .from("trade_messages").insert`,
  );
  // Send-owned useMutation is banned; Realtime may keep useQueryClient.
  assert.doesNotMatch(
    text,
    /useMutation\s*[<(]/,
    `${INBOX} must not own useMutation after send extraction`,
  );
});

test("marketplace message send — Realtime Supabase usage remains allowed", () => {
  const full = join(ROOT, INBOX);
  const text = stripAllComments(readFileSync(full, "utf8"));

  assert.match(text, /@\/platform\/supabase/, `${INBOX} may keep platform supabase for Realtime`);
  assert.match(text, /\.channel\s*\(/, `${INBOX} must retain channel creation`);
  assert.match(text, /postgres_changes/, `${INBOX} must retain postgres_changes`);
  assert.match(text, /removeChannel/, `${INBOX} must retain removeChannel`);
  assert.match(text, /useQueryClient/, `${INBOX} must retain useQueryClient for Realtime`);
  // Table name in Realtime config is allowed (not an insert).
  assert.match(text, /trade_messages/, `${INBOX} may reference trade_messages for Realtime`);
});

test("marketplace message send — trade_messages inserts limited to marketplace-write", () => {
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
      if (rel === WRITE_MODULE) continue;
      if (rel === READ_MODULE) continue; // read-only selects remain authorised
      const text = stripAllComments(readFileSync(file, "utf8"));
      if (!FROM_TRADE_MESSAGES.test(text)) continue;
      if (INSERT_AFTER_FROM.test(text)) {
        violations.push(rel);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `trade_messages insert outside ${WRITE_MODULE}:\n${violations.join("\n")}`,
  );
});

test("marketplace message send — write module exports sendTradeMessage", () => {
  const full = join(ROOT, WRITE_MODULE);
  assert.ok(existsSync(full), `missing ${WRITE_MODULE}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /export\s+async\s+function\s+sendTradeMessage/);
  assert.match(text, FROM_TRADE_MESSAGES);
  assert.doesNotMatch(text, /@tanstack\/react-query/);
});

test("marketplace message send — probe: direct insert pattern is forbidden in inbox", () => {
  const sample = `import { supabase } from "@/platform/supabase/browser";
await supabase.from("trade_messages").insert({ body: "x" });`;
  const text = stripAllComments(sample);
  assert.match(text, INSERT_AFTER_FROM);
  assert.match(text, /@\/platform\/supabase/);
});

test("marketplace message send — probe: auth.getUser is banned pattern", () => {
  const sample = `const user = auth.getUser();`;
  assert.match(sample, /auth\.getUser\s*\(/);
});

test("marketplace message send — probe: string-only useSendTradeMessage does not satisfy call", () => {
  const sample = `const useSendTradeMessage = "string only";`;
  assert.doesNotMatch(sample, /useSendTradeMessage\s*\(/);
});

test("marketplace message send — probe: Realtime subscription remains allowed pattern", () => {
  const sample = `supabase
  .channel("messages")
  .on(
    "postgres_changes",
    {
      schema: "public",
      table: "trade_messages",
    },
    callback,
  );`;
  const text = stripAllComments(sample);
  assert.match(text, /postgres_changes/);
  assert.match(text, /trade_messages/);
  assert.doesNotMatch(text, INSERT_AFTER_FROM);
});

test("marketplace message send — probe: insert in other presentation component fails write-authority", () => {
  const samplePath = "src/components/marketplace/FakeOther.tsx";
  const sample = `await supabase.from("trade_messages").insert({ body: "x" });`;
  assert.match(sample, INSERT_AFTER_FROM);
  // Document that write-authority scan would flag any non-write-module path.
  assert.notEqual(samplePath, WRITE_MODULE);
});
