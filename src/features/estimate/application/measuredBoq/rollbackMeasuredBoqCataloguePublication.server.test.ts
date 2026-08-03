/**
 * Unit tests for B2E rollback-retire application command (no live RPC).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const REQUEST_ID = "23111111-1111-4111-8111-111111111111";
const REVISION_ID = "33111111-1111-4111-8111-111111111111";
const PRIOR_ID = "34111111-1111-4111-8111-111111111111";

vi.mock("../../infrastructure/catalogue/measuredBoqCatalogueLifecycle.repository.server", () => ({
  CatalogueLifecycleRpcError: class CatalogueLifecycleRpcError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  rollbackMeasuredBoqCataloguePublicationRpc: vi.fn(async () => ({
    outcome: "rollback_recorded",
    revisionId: REVISION_ID,
    previousStatus: "published",
    newStatus: "retired",
    eventId: "43111111-1111-4111-8111-111111111111",
    requestId: REQUEST_ID,
    idempotentReplay: false,
  })),
}));

import { rollbackMeasuredBoqCataloguePublication } from "./rollbackMeasuredBoqCataloguePublication.server";
import { rollbackMeasuredBoqCataloguePublicationRpc } from "../../infrastructure/catalogue/measuredBoqCatalogueLifecycle.repository.server";

describe("rollbackMeasuredBoqCataloguePublication application command", () => {
  it("rejects identical target and prior without repository call", async () => {
    const result = await rollbackMeasuredBoqCataloguePublication({
      revisionId: REVISION_ID,
      priorRevisionId: REVISION_ID,
      expectedStatus: "published",
      reason: "rollback",
      requestId: REQUEST_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_REQUEST");
    expect(rollbackMeasuredBoqCataloguePublicationRpc).not.toHaveBeenCalled();
  });

  it("rejects blank reason without repository call", async () => {
    const result = await rollbackMeasuredBoqCataloguePublication({
      revisionId: REVISION_ID,
      priorRevisionId: PRIOR_ID,
      expectedStatus: "published",
      reason: "",
      requestId: REQUEST_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_REQUEST");
    expect(rollbackMeasuredBoqCataloguePublicationRpc).not.toHaveBeenCalled();
  });

  it("invokes repository once for valid inputs", async () => {
    vi.mocked(rollbackMeasuredBoqCataloguePublicationRpc).mockClear();
    const result = await rollbackMeasuredBoqCataloguePublication({
      revisionId: REVISION_ID,
      priorRevisionId: PRIOR_ID,
      expectedStatus: "published",
      reason: "erroneous publish",
      requestId: REQUEST_ID,
    });
    expect(result.ok).toBe(true);
    expect(rollbackMeasuredBoqCataloguePublicationRpc).toHaveBeenCalledTimes(1);
    expect(rollbackMeasuredBoqCataloguePublicationRpc).toHaveBeenCalledWith({
      revisionId: REVISION_ID,
      priorRevisionId: PRIOR_ID,
      expectedStatus: "published",
      reason: "erroneous publish",
      requestId: REQUEST_ID,
    });
  });

  it("source has no active pointer or B1", () => {
    const src = readFileSync(
      join(
        process.cwd(),
        "src/features/estimate/application/measuredBoq/rollbackMeasuredBoqCataloguePublication.server.ts",
      ),
      "utf8",
    );
    expect(src).toMatch(/rollbackMeasuredBoqCataloguePublicationRpc/);
    expect(src).not.toMatch(/runCatalogueDryRun|active_revision|set_active/);
    expect(src).not.toMatch(/@ts-expect-error|@ts-ignore|\bas any\b|as unknown as/);
  });
});
