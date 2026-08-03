/**
 * Unit tests for B2E lifecycle repository mapping and one-RPC boundary.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = join(
  process.cwd(),
  "src/features/estimate/infrastructure/catalogue/measuredBoqCatalogueLifecycle.repository.server.ts",
);

describe("measuredBoqCatalogueLifecycle.repository.server", () => {
  it("exposes exactly three RPCs and no direct table writers", () => {
    const src = readFileSync(REPO, "utf8");
    expect(src).toMatch(/publish_measured_boq_catalog_revision/);
    expect(src).toMatch(/retire_measured_boq_catalog_revision/);
    expect(src).toMatch(/rollback_measured_boq_catalog_publication/);
    expect((src.match(/supabase\.rpc\s*\(/g) ?? []).length).toBe(3);
    expect(src).not.toMatch(/\.from\s*\(\s*["']measured_boq_catalog_/);
    expect(src).not.toMatch(/persist_measured_boq_catalog_draft/);
    expect(src).not.toMatch(/republish_as_new|set_active|active_revision/);
    expect(src).not.toMatch(/@ts-expect-error|@ts-ignore|\bas any\b|as unknown as/);
  });

  it("is server-only and uses service-role client factory", () => {
    const src = readFileSync(REPO, "utf8");
    expect(src).toMatch(/createServiceRoleSupabase/);
    expect(src).not.toMatch(
      /createBrowserClient|createBrowserSupabase|from ["']@repo\/supabase\/browser["']/,
    );
  });

  it("each exported method maps to exactly one RPC name", () => {
    const src = readFileSync(REPO, "utf8");
    expect(src).toMatch(
      /export async function publishMeasuredBoqCatalogueRevisionRpc[\s\S]*?publish_measured_boq_catalog_revision/,
    );
    expect(src).toMatch(
      /export async function retireMeasuredBoqCatalogueRevisionRpc[\s\S]*?retire_measured_boq_catalog_revision/,
    );
    expect(src).toMatch(
      /export async function rollbackMeasuredBoqCataloguePublicationRpc[\s\S]*?rollback_measured_boq_catalog_publication/,
    );
  });
});
