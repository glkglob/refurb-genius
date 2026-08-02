/**
 * Unit tests for B2D persistence repository mapping.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = join(
  process.cwd(),
  "src/features/estimate/infrastructure/catalogue/measuredBoqCataloguePersistence.repository.server.ts",
);

describe("measuredBoqCataloguePersistence.repository.server", () => {
  it("calls only persist_measured_boq_catalog_draft and never table writers", () => {
    const src = readFileSync(REPO, "utf8");
    expect(src).toMatch(/persist_measured_boq_catalog_draft/);
    expect((src.match(/\.rpc\s*\(/g) ?? []).length).toBe(1);
    expect(src).not.toMatch(/\.from\s*\(\s*["']measured_boq_catalog_/);
    expect(src).not.toMatch(
      /publish_measured_boq_catalog|retire_measured_boq_catalog|rollback_measured_boq/,
    );
    expect(src).not.toMatch(/@ts-expect-error|@ts-ignore|\bas any\b|as unknown as/);
  });

  it("is server-only and uses service-role client factory", () => {
    const src = readFileSync(REPO, "utf8");
    expect(src).toMatch(/createServiceRoleSupabase/);
    expect(src).not.toMatch(
      /createBrowserClient|createBrowserSupabase|from ["']@repo\/supabase\/browser["']/,
    );
  });
});
