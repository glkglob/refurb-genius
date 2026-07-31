import { describe, expect, it } from "vitest";
import {
  decodeSaveAuthorityCategoryEstimateCommand,
  measureAuthorityRequestBytes,
} from "./decodeSaveAuthorityCategoryEstimateCommand";
import { MAX_AUTHORITY_REQUEST_BYTES, MAX_IDEMPOTENCY_KEY_LENGTH } from "./authorityCommandPolicy";
import { AuthorityError } from "./authorityErrors";

const VALID = {
  projectId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  inputs: {
    region: "London",
    property_condition: "Dated",
    finish_quality: "Standard",
    selected_categories: ["Kitchen", "Bathroom"],
    property_size_sqm: 90,
  },
  idempotencyKey: "intent-1",
};

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
    expect.fail("expected AuthorityError");
  } catch (e) {
    expect(e).toBeInstanceOf(AuthorityError);
    expect((e as AuthorityError).code).toBe(code);
  }
}

describe("decodeSaveAuthorityCategoryEstimateCommand", () => {
  it("accepts a valid category command", () => {
    const cmd = decodeSaveAuthorityCategoryEstimateCommand(VALID);
    expect(cmd.projectId).toBe(VALID.projectId);
    expect(cmd.inputs.selected_categories).toEqual(["Kitchen", "Bathroom"]);
    expect(cmd.idempotencyKey).toBe("intent-1");
  });

  it("rejects unknown top-level field", () => {
    expectCode(
      () => decodeSaveAuthorityCategoryEstimateCommand({ ...VALID, extra: true }),
      "FORBIDDEN_AUTHORITY_FIELD",
    );
  });

  it("rejects unknown nested field", () => {
    expectCode(
      () =>
        decodeSaveAuthorityCategoryEstimateCommand({
          ...VALID,
          inputs: { ...VALID.inputs, bonus: 1 },
        }),
      "FORBIDDEN_AUTHORITY_FIELD",
    );
  });

  it("rejects subtotal", () => {
    expectCode(
      () => decodeSaveAuthorityCategoryEstimateCommand({ ...VALID, subtotal: 100 }),
      "FORBIDDEN_AUTHORITY_FIELD",
    );
  });

  it("rejects VAT fields", () => {
    expectCode(
      () => decodeSaveAuthorityCategoryEstimateCommand({ ...VALID, vat: 20 }),
      "FORBIDDEN_AUTHORITY_FIELD",
    );
  });

  it("rejects low/mid/high", () => {
    expectCode(
      () => decodeSaveAuthorityCategoryEstimateCommand({ ...VALID, midTotal: 1 }),
      "FORBIDDEN_AUTHORITY_FIELD",
    );
  });

  it("rejects lineItems", () => {
    expectCode(
      () => decodeSaveAuthorityCategoryEstimateCommand({ ...VALID, lineItems: [] }),
      "FORBIDDEN_AUTHORITY_FIELD",
    );
  });

  it("rejects userId", () => {
    expectCode(
      () => decodeSaveAuthorityCategoryEstimateCommand({ ...VALID, userId: "x" }),
      "FORBIDDEN_AUTHORITY_FIELD",
    );
  });

  it("rejects expectedOwnerId", () => {
    expectCode(
      () => decodeSaveAuthorityCategoryEstimateCommand({ ...VALID, expectedOwnerId: "x" }),
      "FORBIDDEN_AUTHORITY_FIELD",
    );
  });

  it("rejects authority marker", () => {
    expectCode(
      () =>
        decodeSaveAuthorityCategoryEstimateCommand({
          ...VALID,
          pricingAuthority: "category-engine",
        }),
      "FORBIDDEN_AUTHORITY_FIELD",
    );
  });

  it("rejects policy version", () => {
    expectCode(
      () =>
        decodeSaveAuthorityCategoryEstimateCommand({
          ...VALID,
          pricing_policy_version: "category-engine-v1",
        }),
      "FORBIDDEN_AUTHORITY_FIELD",
    );
  });

  it("rejects null", () => {
    expectCode(() => decodeSaveAuthorityCategoryEstimateCommand(null), "INVALID_AUTHORITY_COMMAND");
  });

  it("rejects array root", () => {
    expectCode(() => decodeSaveAuthorityCategoryEstimateCommand([]), "INVALID_AUTHORITY_COMMAND");
  });

  it("rejects invalid UUID", () => {
    expectCode(
      () => decodeSaveAuthorityCategoryEstimateCommand({ ...VALID, projectId: "not-a-uuid" }),
      "INVALID_AUTHORITY_FIELD_VALUE",
    );
  });

  it("rejects empty idempotency key", () => {
    expectCode(
      () => decodeSaveAuthorityCategoryEstimateCommand({ ...VALID, idempotencyKey: "" }),
      "INVALID_AUTHORITY_FIELD_VALUE",
    );
  });

  it("rejects overlong idempotency key", () => {
    expectCode(
      () =>
        decodeSaveAuthorityCategoryEstimateCommand({
          ...VALID,
          idempotencyKey: "k".repeat(MAX_IDEMPOTENCY_KEY_LENGTH + 1),
        }),
      "FIELD_TOO_LONG",
    );
  });

  it("accepts idempotency key at max length", () => {
    const cmd = decodeSaveAuthorityCategoryEstimateCommand({
      ...VALID,
      idempotencyKey: "k".repeat(MAX_IDEMPOTENCY_KEY_LENGTH),
    });
    expect(cmd.idempotencyKey).toHaveLength(MAX_IDEMPOTENCY_KEY_LENGTH);
  });

  it("rejects oversized request", () => {
    const huge = {
      ...VALID,
      idempotencyKey: "x".repeat(MAX_AUTHORITY_REQUEST_BYTES),
    };
    expect(measureAuthorityRequestBytes(huge)).toBeGreaterThan(MAX_AUTHORITY_REQUEST_BYTES);
    expectCode(
      () => decodeSaveAuthorityCategoryEstimateCommand(huge),
      "AUTHORITY_REQUEST_TOO_LARGE",
    );
  });

  it("rejects invalid region", () => {
    expectCode(
      () =>
        decodeSaveAuthorityCategoryEstimateCommand({
          ...VALID,
          inputs: { ...VALID.inputs, region: "Atlantis" },
        }),
      "INVALID_AUTHORITY_FIELD_VALUE",
    );
  });

  it("rejects invalid condition", () => {
    expectCode(
      () =>
        decodeSaveAuthorityCategoryEstimateCommand({
          ...VALID,
          inputs: { ...VALID.inputs, property_condition: "Ruined" },
        }),
      "INVALID_AUTHORITY_FIELD_VALUE",
    );
  });

  it("rejects invalid finish", () => {
    expectCode(
      () =>
        decodeSaveAuthorityCategoryEstimateCommand({
          ...VALID,
          inputs: { ...VALID.inputs, finish_quality: "Luxury" },
        }),
      "INVALID_AUTHORITY_FIELD_VALUE",
    );
  });

  it("rejects empty categories", () => {
    expectCode(
      () =>
        decodeSaveAuthorityCategoryEstimateCommand({
          ...VALID,
          inputs: { ...VALID.inputs, selected_categories: [] },
        }),
      "INVALID_AUTHORITY_FIELD_VALUE",
    );
  });

  it("rejects duplicate categories", () => {
    expectCode(
      () =>
        decodeSaveAuthorityCategoryEstimateCommand({
          ...VALID,
          inputs: {
            ...VALID.inputs,
            selected_categories: ["Kitchen", "Kitchen"],
          },
        }),
      "INVALID_AUTHORITY_FIELD_VALUE",
    );
  });

  it("rejects unknown category", () => {
    expectCode(
      () =>
        decodeSaveAuthorityCategoryEstimateCommand({
          ...VALID,
          inputs: {
            ...VALID.inputs,
            selected_categories: ["Spaceship"],
          },
        }),
      "INVALID_AUTHORITY_FIELD_VALUE",
    );
  });

  it("rejects non-array categories", () => {
    expectCode(
      () =>
        decodeSaveAuthorityCategoryEstimateCommand({
          ...VALID,
          inputs: {
            ...VALID.inputs,
            selected_categories: "Kitchen",
          },
        }),
      "INVALID_AUTHORITY_FIELD_TYPE",
    );
  });

  it("rejects NaN size", () => {
    expectCode(
      () =>
        decodeSaveAuthorityCategoryEstimateCommand({
          ...VALID,
          inputs: { ...VALID.inputs, property_size_sqm: Number.NaN },
        }),
      "INVALID_AUTHORITY_FIELD_VALUE",
    );
  });

  it("rejects Infinity size", () => {
    expectCode(
      () =>
        decodeSaveAuthorityCategoryEstimateCommand({
          ...VALID,
          inputs: { ...VALID.inputs, property_size_sqm: Number.POSITIVE_INFINITY },
        }),
      "INVALID_AUTHORITY_FIELD_VALUE",
    );
  });

  it("rejects zero size", () => {
    expectCode(
      () =>
        decodeSaveAuthorityCategoryEstimateCommand({
          ...VALID,
          inputs: { ...VALID.inputs, property_size_sqm: 0 },
        }),
      "INVALID_AUTHORITY_FIELD_VALUE",
    );
  });

  it("rejects negative size", () => {
    expectCode(
      () =>
        decodeSaveAuthorityCategoryEstimateCommand({
          ...VALID,
          inputs: { ...VALID.inputs, property_size_sqm: -1 },
        }),
      "INVALID_AUTHORITY_FIELD_VALUE",
    );
  });

  it("fails before any external side effects (pure decode)", () => {
    // Decoder has no hooks; invalid payload throws synchronously.
    let threw = false;
    try {
      decodeSaveAuthorityCategoryEstimateCommand({ subtotal: 1 });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
