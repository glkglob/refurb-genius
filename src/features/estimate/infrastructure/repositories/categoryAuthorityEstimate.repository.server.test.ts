import { describe, expect, it } from "vitest";
import { mapRpcError } from "./categoryAuthorityEstimate.repository.server";

describe("mapRpcError", () => {
  it("maps IDEMPOTENCY_CONFLICT via code+message", () => {
    const err = mapRpcError({ code: "23505", message: "IDEMPOTENCY_CONFLICT" });
    expect(err.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("maps PROJECT_NOT_FOUND via P0002", () => {
    const err = mapRpcError({ code: "P0002", message: "PROJECT_NOT_FOUND" });
    expect(err.code).toBe("PROJECT_NOT_FOUND");
  });

  it("maps PROJECT_OWNERSHIP_CHANGED via P0001", () => {
    const err = mapRpcError({ code: "P0001", message: "PROJECT_OWNERSHIP_CHANGED" });
    expect(err.code).toBe("PROJECT_OWNERSHIP_CHANGED");
  });

  it("maps INVALID_AUTHORITY_FIELD_VALUE via 22023", () => {
    const err = mapRpcError({ code: "22023", message: "INVALID_AUTHORITY_FIELD_VALUE" });
    expect(err.code).toBe("INVALID_AUTHORITY_FIELD_VALUE");
  });

  it("does not treat bare unique_violation without message as idempotency conflict", () => {
    const err = mapRpcError({ code: "23505", message: "duplicate key value" });
    expect(err.code).toBe("AUTHORITY_PERSISTENCE_FAILED");
  });

  it("falls back to message matching", () => {
    const err = mapRpcError({ message: "ERROR: PROJECT_OWNERSHIP_CHANGED" });
    expect(err.code).toBe("PROJECT_OWNERSHIP_CHANGED");
  });
});
