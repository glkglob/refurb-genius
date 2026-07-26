/**
 * AO-1B1 — TradepersonCard must not own trade_favorites infrastructure.
 *
 * Strength: lexical (comment-stripped source scan). Known bypasses: alias
 * reassignment of a Supabase client imported under another name, dynamic
 * import strings split across concatenations.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const CARD = "src/components/marketplace/TradepersonCard.tsx";
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

const FROM_TRADE_FAVORITES = /\.from\s*\(\s*["']trade_favorites["']\s*\)/;
const WRITE_OPS = /\.(?:insert|update|upsert|delete)\s*\(/;

test("marketplace favorites — TradepersonCard uses useToggleTradeFavorite", () => {
  const full = join(ROOT, CARD);
  assert.ok(existsSync(full), `missing ${CARD}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /useToggleTradeFavorite/, `${CARD} must use useToggleTradeFavorite`);
  assert.match(text, /useToggleTradeFavorite\s*\(/, `${CARD} must call useToggleTradeFavorite(`);
});

test("marketplace favorites — TradepersonCard has no Supabase / Auth client / table writes", () => {
  const full = join(ROOT, CARD);
  const text = stripAllComments(readFileSync(full, "utf8"));

  assert.doesNotMatch(text, /@\/platform\/supabase/, `${CARD} must not import platform supabase`);
  assert.doesNotMatch(text, /@\/lib\/supabase/, `${CARD} must not import @/lib/supabase`);
  assert.doesNotMatch(text, /@supabase\/supabase-js/, `${CARD} must not import supabase-js`);
  assert.doesNotMatch(text, /supabase\.auth/, `${CARD} must not use supabase.auth`);
  assert.doesNotMatch(text, /auth\.getUser\s*\(/, `${CARD} must not call auth.getUser(`);
  assert.doesNotMatch(text, FROM_TRADE_FAVORITES, `${CARD} must not call .from("trade_favorites")`);
});

test("marketplace favorites — trade_favorites writes limited to marketplace-write", () => {
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
      const text = stripAllComments(readFileSync(file, "utf8"));
      if (!FROM_TRADE_FAVORITES.test(text)) continue;
      // Allow read-only marketplace query module if it only selects.
      if (rel === READ_MODULE) {
        // Write methods adjacent to trade_favorites from-call are banned in this module.
        const hasWrite =
          /\.from\s*\(\s*["']trade_favorites["']\s*\)[\s\S]{0,200}\.(?:insert|update|upsert|delete)\s*\(/.test(
            text,
          ) ||
          /\.(?:insert|update|upsert|delete)\s*\([\s\S]{0,80}\.from\s*\(\s*["']trade_favorites["']\s*\)/.test(
            text,
          );
        // queries module uses .from("trade_favorites").select — not insert/delete
        if (/\.insert\s*\(|\.delete\s*\(|\.update\s*\(|\.upsert\s*\(/.test(text) && hasWrite) {
          violations.push(rel);
        }
        // Read module may still contain insert/delete in comments — stripped.
        // Ensure no insert/delete chained after trade_favorites in read module:
        if (
          /\.from\s*\(\s*["']trade_favorites["']\s*\)\s*\n?\s*\.\s*(?:insert|delete|update|upsert)\s*\(/.test(
            text,
          )
        ) {
          violations.push(rel);
        }
        continue;
      }
      // Any other file with trade_favorites from() that also has write ops in file is suspect;
      // require write ops near the table for non-write modules.
      if (WRITE_OPS.test(text) && FROM_TRADE_FAVORITES.test(text)) {
        // Narrow: only flag if write is chained after from(trade_favorites)
        if (
          /\.from\s*\(\s*["']trade_favorites["']\s*\)[\s\S]{0,120}\.(?:insert|update|upsert|delete)\s*\(/.test(
            text,
          )
        ) {
          violations.push(rel);
        }
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `trade_favorites write outside ${WRITE_MODULE}:\n${violations.join("\n")}`,
  );
});

test("marketplace favorites — write module exists and exports primitives", () => {
  const full = join(ROOT, WRITE_MODULE);
  assert.ok(existsSync(full), `missing ${WRITE_MODULE}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /export\s+async\s+function\s+addTradeFavorite/);
  assert.match(text, /export\s+async\s+function\s+removeTradeFavorite/);
  assert.match(text, FROM_TRADE_FAVORITES);
  assert.doesNotMatch(text, /@tanstack\/react-query/);
});

test("marketplace favorites — probe: direct insert pattern is forbidden in card", () => {
  const sample = `import { supabase } from "@/platform/supabase/browser";
await supabase.from("trade_favorites").insert({ user_id: "u", tradesperson_id: "t" });`;
  const text = stripAllComments(sample);
  assert.match(text, FROM_TRADE_FAVORITES);
  assert.match(text, /@\/platform\/supabase/);
});

test("marketplace favorites — probe: string-only useToggleTradeFavorite does not satisfy call", () => {
  const sample = `const useToggleTradeFavorite = "string only";`;
  assert.doesNotMatch(sample, /useToggleTradeFavorite\s*\(/);
});
