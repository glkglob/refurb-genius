/**
 * P0-AUTH-1 — Tracked magic-link email template and local config contracts.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const CONFIG = "supabase/config.toml";
const TEMPLATE = "supabase/templates/magic-link.html";

function read(rel: string): string {
  const full = join(ROOT, rel);
  assert.ok(existsSync(full), `missing ${rel}`);
  return readFileSync(full, "utf8");
}

test("auth magic-link template — tracked file exists", () => {
  assert.ok(existsSync(join(ROOT, TEMPLATE)), `missing ${TEMPLATE}`);
});

test("auth magic-link template — config points at tracked template", () => {
  const config = read(CONFIG);
  assert.match(config, /\[auth\.email\.template\.magic_link\]/);
  assert.match(config, /subject\s*=\s*"Your Refurb Genius sign-in link"/);
  assert.match(config, /content_path\s*=\s*"\.\/supabase\/templates\/magic-link\.html"/);
});

test("auth magic-link template — uses RedirectTo, TokenHash, type=email", () => {
  const html = read(TEMPLATE);
  assert.match(html, /\{\{\s*\.RedirectTo\s*\}\}/);
  assert.match(html, /\{\{\s*\.TokenHash\s*\}\}/);
  assert.match(html, /type=email/);
  assert.match(html, /token_hash=\{\{\s*\.TokenHash\s*\}\}/);
});

test("auth magic-link template — does not use ConfirmationURL", () => {
  const html = read(TEMPLATE);
  assert.doesNotMatch(html, /\{\{\s*\.ConfirmationURL\s*\}\}/);
});

test("auth magic-link template — no remote tracking image", () => {
  const html = read(TEMPLATE);
  assert.doesNotMatch(html, /<img[^>]+src=["']https?:\/\//i);
  assert.doesNotMatch(html, /tracking|analytics|pixel/i);
});
