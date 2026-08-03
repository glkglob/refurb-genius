/**
 * Unit tests for B2E retire application command (no live RPC).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const REQUEST_ID = "22111111-1111-4111-8111-111111111111";
const REVISION_ID = "32111111-1111-4111-8111-111111111111";

vi.mock("../../infrastructure/catalogue/measuredBoqCatalogueLifecycle.repository.server", () => ({
  CatalogueLifecycleRpcError: class CatalogueLifecycleRpcError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  retireMeasuredBoqCatalogueRevisionRpc: vi.fn(async () => ({
    outcome: "retired",
    revisionId: REVISION_ID,
    previousStatus: "published",
    newStatus: "retired",
    eventId: "42111111-1111-4111-8111-111111111111",
    requestId: REQUEST_ID,
    idempotentReplay: false,
  })),
}));

import { retireMeasuredBoqCatalogueRevision } from "./retireMeasuredBoqCatalogueRevision.server";
import { retireMeasuredBoqCatalogueRevisionRpc } from "../../infrastructure/catalogue/measuredBoqCatalogueLifecycle.repository.server";

describe("retireMeasuredBoqCatalogueRevision application command", () => {
  it("rejects blank reason without repository call", async () => {
    const result = await retireMeasuredBoqCatalogueRevision({
      revisionId: REVISION_ID,
      expectedStatus: "published",
      reason: "   ",
      requestId: REQUEST_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_REQUEST");
    expect(retireMeasuredBoqCatalogueRevisionRpc).not.toHaveBeenCalled();
  });

  it("rejects oversize reason without repository call", async () => {
    const result = await retireMeasuredBoqCatalogueRevision({
      revisionId: REVISION_ID,
      expectedStatus: "published",
      reason: "x".repeat(2001),
      requestId: REQUEST_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_REQUEST");
    expect(retireMeasuredBoqCatalogueRevisionRpc).not.toHaveBeenCalled();
  });

  it("invokes repository once for valid inputs", async () => {
    vi.mocked(retireMeasuredBoqCatalogueRevisionRpc).mockClear();
    const result = await retireMeasuredBoqCatalogueRevision({
      revisionId: REVISION_ID,
      expectedStatus: "published",
      reason: "  superseded  ",
      requestId: REQUEST_ID,
    });
    expect(result.ok).toBe(true);
    expect(retireMeasuredBoqCatalogueRevisionRpc).toHaveBeenCalledTimes(1);
    expect(retireMeasuredBoqCatalogueRevisionRpc).toHaveBeenCalledWith({
      revisionId: REVISION_ID,
      expectedStatus: "published",
      reason: "superseded",
      requestId: REQUEST_ID,
    });
  });

  it("source has no B1 or suppressions", () => {
    const src = readFileSync(
      join(
        process.cwd(),
        "src/features/estimate/application/measuredBoq/retireMeasuredBoqCatalogueRevision.server.ts",
      ),
      "utf8",
    );
    expect(src).toMatch(/retireMeasuredBoqCatalogueRevisionRpc/);
    expect(src).not.toMatch(/runCatalogueDryRun|persistMeasuredBoqCatalogueDraft/);
    expect(src).not.toMatch(/@ts-expect-error|@ts-ignore|\bas any\b|as unknown as/);
  });
});
