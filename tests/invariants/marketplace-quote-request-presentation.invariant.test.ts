/**
 * AO-1B2 — QuoteRequestDialog must not own quote_requests infrastructure.
 *
 * Strength: lexical (comment-stripped source scan). Known bypasses: alias
 * reassignment of a Supabase client imported under another name, dynamic
 * import strings split across concatenations.
 *
 * Does not ban all marketplace Supabase access (MessagingInbox remains deferred).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const DIALOG = "src/components/marketplace/QuoteRequestDialog.tsx";
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

const FROM_QUOTE_REQUESTS = /\.from\s*\(\s*["']quote_requests["']\s*\)/;

test("marketplace quote request — QuoteRequestDialog uses useCreateQuoteRequest", () => {
  const full = join(ROOT, DIALOG);
  assert.ok(existsSync(full), `missing ${DIALOG}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /useCreateQuoteRequest/, `${DIALOG} must use useCreateQuoteRequest`);
  assert.match(text, /useCreateQuoteRequest\s*\(/, `${DIALOG} must call useCreateQuoteRequest(`);
});

test("marketplace quote request — QuoteRequestDialog has no Supabase / Auth client / table writes", () => {
  const full = join(ROOT, DIALOG);
  const text = stripAllComments(readFileSync(full, "utf8"));

  assert.doesNotMatch(text, /@\/platform\/supabase/, `${DIALOG} must not import platform supabase`);
  assert.doesNotMatch(text, /@\/lib\/supabase/, `${DIALOG} must not import @/lib/supabase`);
  assert.doesNotMatch(text, /@supabase\/supabase-js/, `${DIALOG} must not import supabase-js`);
  assert.doesNotMatch(text, /supabase\.auth/, `${DIALOG} must not use supabase.auth`);
  assert.doesNotMatch(text, /auth\.getUser\s*\(/, `${DIALOG} must not call auth.getUser(`);
  assert.doesNotMatch(text, FROM_QUOTE_REQUESTS, `${DIALOG} must not call .from("quote_requests")`);
  assert.doesNotMatch(text, /useQueryClient/, `${DIALOG} must not use useQueryClient`);
  assert.doesNotMatch(text, /invalidateQueries/, `${DIALOG} must not invalidate queries directly`);
});

test("marketplace quote request — quote_requests inserts limited to marketplace-write", () => {
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
      if (!FROM_QUOTE_REQUESTS.test(text)) continue;
      // Flag write chained after from(quote_requests)
      if (
        /\.from\s*\(\s*["']quote_requests["']\s*\)[\s\S]{0,120}\.(?:insert|update|upsert|delete)\s*\(/.test(
          text,
        )
      ) {
        violations.push(rel);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `quote_requests write outside ${WRITE_MODULE}:\n${violations.join("\n")}`,
  );
});

test("marketplace quote request — write module exports createQuoteRequest", () => {
  const full = join(ROOT, WRITE_MODULE);
  assert.ok(existsSync(full), `missing ${WRITE_MODULE}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /export\s+async\s+function\s+createQuoteRequest/);
  assert.match(text, FROM_QUOTE_REQUESTS);
  assert.doesNotMatch(text, /@tanstack\/react-query/);
});

test("marketplace quote request — probe: direct insert pattern is forbidden in dialog", () => {
  const sample = `import { supabase } from "@/platform/supabase/browser";
await supabase.from("quote_requests").insert([{ user_id: "u" }]);`;
  const text = stripAllComments(sample);
  assert.match(text, FROM_QUOTE_REQUESTS);
  assert.match(text, /@\/platform\/supabase/);
});

test("marketplace quote request — probe: string-only useCreateQuoteRequest does not satisfy call", () => {
  const sample = `const useCreateQuoteRequest = "string only";`;
  assert.doesNotMatch(sample, /useCreateQuoteRequest\s*\(/);
});
