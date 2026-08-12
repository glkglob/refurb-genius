/**
 * IOS-READINESS-2B-3 — pure native AuthUser mapper contracts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mapNativeSupabaseUser } from "./mapNativeSupabaseUser";

const SRC = join(__dirname, "mapNativeSupabaseUser.ts");

describe("mapNativeSupabaseUser", () => {
  it("returns null for null/undefined", () => {
    expect(mapNativeSupabaseUser(null)).toBeNull();
    expect(mapNativeSupabaseUser(undefined)).toBeNull();
  });

  it("maps id and empty email when email is null", () => {
    expect(
      mapNativeSupabaseUser({
        id: "u1",
        email: null,
      }),
    ).toEqual({ id: "u1", email: "", fullName: undefined });
  });

  it("prefers user_metadata.full_name", () => {
    expect(
      mapNativeSupabaseUser({
        id: "u2",
        email: "a@b.com",
        user_metadata: { full_name: "Ada Lovelace", name: "Ada" },
      }),
    ).toEqual({ id: "u2", email: "a@b.com", fullName: "Ada Lovelace" });
  });

  it("falls back to user_metadata.name", () => {
    expect(
      mapNativeSupabaseUser({
        id: "u3",
        email: "c@d.com",
        user_metadata: { name: "Grace" },
      }),
    ).toEqual({ id: "u3", email: "c@d.com", fullName: "Grace" });
  });

  it("ignores non-string metadata name fields", () => {
    expect(
      mapNativeSupabaseUser({
        id: "u4",
        email: "e@f.com",
        user_metadata: { full_name: 1, name: true },
      }),
    ).toEqual({ id: "u4", email: "e@f.com", fullName: undefined });
  });

  it("is pure and native-safe (type-only AuthUser; no browser/_client value imports)", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).toMatch(/import type \{ AuthUser \}/);
    expect(src).not.toMatch(/import\s*\{[^}]*fromSupabaseUser|import\s*\{\s*auth\b/);
    expect(src).not.toMatch(/fromSupabaseUser|browser|_client|getNativeSupabase|createClient/);
  });
});
