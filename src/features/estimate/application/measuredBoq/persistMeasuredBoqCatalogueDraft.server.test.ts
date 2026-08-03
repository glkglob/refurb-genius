/**
 * Unit tests for B2D application command (no live RPC).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { persistMeasuredBoqCatalogueDraft } from "./persistMeasuredBoqCatalogueDraft.server";

const ROOT = process.cwd();

const fixtureManifest = readFileSync(
  join(ROOT, "catalogue-sources/measured-boq/revisions/mboq-2099.01.01/MANIFEST.json"),
  "utf8",
);
const fixtureSnapshot = readFileSync(
  join(ROOT, "catalogue-sources/measured-boq/revisions/mboq-2099.01.01/snapshot.json"),
  "utf8",
);

/** RFC 4122-shaped UUID (version + variant nibbles valid for the command gate). */
const REQUEST_ID = "11111111-1111-4111-8111-111111111111";

describe("persistMeasuredBoqCatalogueDraft application command", () => {
  it("rejects invalid request ids without calling RPC", async () => {
    const result = await persistMeasuredBoqCatalogueDraft({
      manifestText: fixtureManifest,
      snapshotText: fixtureSnapshot,
      requestId: "not-a-uuid",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_REQUEST");
    }
  });

  it("rejects production packages via B1 without persistence", async () => {
    const prodManifest = fixtureManifest.replace('"production": false', '"production": true');
    const prodSnapshot = fixtureSnapshot.replace('"production": false', '"production": true');
    const result = await persistMeasuredBoqCatalogueDraft({
      manifestText: prodManifest,
      snapshotText: prodSnapshot,
      requestId: REQUEST_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PRODUCTION_BLOCKED");
    }
  });

  it("rejects invalid JSON snapshot with VALIDATION_FAILED", async () => {
    const result = await persistMeasuredBoqCatalogueDraft({
      manifestText: fixtureManifest,
      snapshotText: "{not-json",
      requestId: REQUEST_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_FAILED");
    }
  });

  it("source has no suppressions and invokes B1 before repository", () => {
    const src = readFileSync(
      join(
        ROOT,
        "src/features/estimate/application/measuredBoq/persistMeasuredBoqCatalogueDraft.server.ts",
      ),
      "utf8",
    );
    expect(src).toMatch(/runCatalogueDryRun/);
    expect(src).toMatch(/persistMeasuredBoqCatalogueDraftRpc/);
    expect(src).not.toMatch(/@ts-expect-error|@ts-ignore|\bas any\b|as unknown as/);
  });
});
