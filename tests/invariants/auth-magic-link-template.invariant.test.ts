/**
 * P0-AUTH-1 / P0-AUTH-TEMPLATE-URL-REPAIR — Tracked magic-link email template contracts.
 *
 * Requires URL query separators to be literal `&` (not HTML entity `&amp;`) so
 * Go/text template rendering and email clients do not emit unusable hrefs.
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

/** Simulate hosted composition: RedirectTo already has a query string. */
function composeCallbackUrl(
  templateSnippet: string,
  redirectTo: string,
  tokenHash: string,
): string {
  return templateSnippet
    .replace(/\{\{\s*\.RedirectTo\s*\}\}/g, redirectTo)
    .replace(/\{\{\s*\.TokenHash\s*\}\}/g, tokenHash);
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

test("auth magic-link template — uses raw & query separators (not &amp;)", () => {
  const html = read(TEMPLATE);
  // Production defect: literal &amp; in template source was delivered into the URL.
  assert.doesNotMatch(html, /&amp;token_hash=/);
  assert.doesNotMatch(html, /&amp;type=email/);
  assert.match(html, /\{\{\s*\.RedirectTo\s*\}\}&token_hash=\{\{\s*\.TokenHash\s*\}\}&type=email/);
});

test("auth magic-link template — href and plain-text fallback share URL semantics", () => {
  const html = read(TEMPLATE);
  const hrefMatch = html.match(/href="([^"]+)"/);
  assert.ok(hrefMatch, "anchor href present");
  const href = hrefMatch[1];
  // Fallback is the same composition (not inside an attribute).
  assert.match(html, /\{\{\s*\.RedirectTo\s*\}\}&token_hash=\{\{\s*\.TokenHash\s*\}\}&type=email/);
  assert.equal(href, "{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email");
});

test("auth magic-link template — composed URL parses with flow, token_hash, type", () => {
  const snippet = "{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email";
  const redirectTo = "https://www.refurbgenius.info/auth/callback?flow=magiclink";
  const tokenHash = "test-token-hash-not-a-real-secret";
  const composed = composeCallbackUrl(snippet, redirectTo, tokenHash);

  assert.doesNotMatch(composed, /&amp;/);
  assert.doesNotMatch(composed, /token_hash=\{\{/);

  const url = new URL(composed);
  assert.equal(url.origin, "https://www.refurbgenius.info");
  assert.equal(url.pathname, "/auth/callback");
  assert.equal(url.searchParams.get("flow"), "magiclink");
  assert.equal(url.searchParams.get("token_hash"), tokenHash);
  assert.equal(url.searchParams.get("type"), "email");
  // No second `?` introduced when RedirectTo already has a query string.
  assert.equal((composed.match(/\?/g) ?? []).length, 1);
});

test("auth magic-link template — composed URL with safe redirect_to remains valid", () => {
  const snippet = "{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email";
  const redirectTo =
    "https://www.refurbgenius.info/auth/callback?flow=magiclink&redirect_to=%2Fprojects";
  const composed = composeCallbackUrl(snippet, redirectTo, "placeholder-hash");
  const url = new URL(composed);
  assert.equal(url.searchParams.get("flow"), "magiclink");
  assert.equal(url.searchParams.get("redirect_to"), "/projects");
  assert.equal(url.searchParams.get("token_hash"), "placeholder-hash");
  assert.equal(url.searchParams.get("type"), "email");
  assert.doesNotMatch(composed, /&amp;/);
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
