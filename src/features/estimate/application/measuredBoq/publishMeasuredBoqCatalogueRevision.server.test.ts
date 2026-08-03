/**
 * Unit tests for B2E publish application command (no live RPC).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const REQUEST_ID = "21111111-1111-4111-8111-111111111111";
const REVISION_ID = "31111111-1111-4111-8111-111111111111";

vi.mock("../../infrastructure/catalogue/measuredBoqCatalogueLifecycle.repository.server", () => ({
  CatalogueLifecycleRpcError: class CatalogueLifecycleRpcError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  publishMeasuredBoqCatalogueRevisionRpc: vi.fn(async () => ({
    outcome: "published",
    revisionId: REVISION_ID,
    previousStatus: "draft",
    newStatus: "published",
    eventId: "41111111-1111-4111-8111-111111111111",
    requestId: REQUEST_ID,
    idempotentReplay: false,
  })),
}));

import { publishMeasuredBoqCatalogueRevision } from "./publishMeasuredBoqCatalogueRevision.server";
import { publishMeasuredBoqCatalogueRevisionRpc } from "../../infrastructure/catalogue/measuredBoqCatalogueLifecycle.repository.server";

describe("publishMeasuredBoqCatalogueRevision application command", () => {
  it("rejects invalid UUIDs without calling the repository", async () => {
    const result = await publishMeasuredBoqCatalogueRevision({
      revisionId: "not-a-uuid",
      expectedStatus: "draft",
      requestId: REQUEST_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_REQUEST");
    expect(publishMeasuredBoqCatalogueRevisionRpc).not.toHaveBeenCalled();
  });

  it("rejects non-draft expected status without repository call", async () => {
    const result = await publishMeasuredBoqCatalogueRevision({
      revisionId: REVISION_ID,
      expectedStatus: "published",
      requestId: REQUEST_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_REQUEST");
    expect(publishMeasuredBoqCatalogueRevisionRpc).not.toHaveBeenCalled();
  });

  it("invokes repository once for valid inputs", async () => {
    vi.mocked(publishMeasuredBoqCatalogueRevisionRpc).mockClear();
    const result = await publishMeasuredBoqCatalogueRevision({
      revisionId: REVISION_ID,
      expectedStatus: "draft",
      requestId: REQUEST_ID,
    });
    expect(result.ok).toBe(true);
    expect(publishMeasuredBoqCatalogueRevisionRpc).toHaveBeenCalledTimes(1);
    expect(publishMeasuredBoqCatalogueRevisionRpc).toHaveBeenCalledWith({
      revisionId: REVISION_ID,
      expectedStatus: "draft",
      requestId: REQUEST_ID,
    });
  });

  it("source has no B1, suppressions, or active pointer", () => {
    const src = readFileSync(
      join(
        process.cwd(),
        "src/features/estimate/application/measuredBoq/publishMeasuredBoqCatalogueRevision.server.ts",
      ),
      "utf8",
    );
    expect(src).toMatch(/publishMeasuredBoqCatalogueRevisionRpc/);
    expect(src).not.toMatch(/runCatalogueDryRun|persistMeasuredBoqCatalogueDraft/);
    expect(src).not.toMatch(/@ts-expect-error|@ts-ignore|\bas any\b|as unknown as/);
    expect(src).not.toMatch(/active_revision|set_active|republish/);
  });
});
