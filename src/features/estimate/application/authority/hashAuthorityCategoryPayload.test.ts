import { describe, expect, it } from "vitest";
import {
  buildAuthorityCategoryHashObject,
  hashAuthorityCategoryPayload,
  hashDecodedCategoryCommand,
} from "./hashAuthorityCategoryPayload";
import { CATEGORY_PRICING_POLICY_VERSION } from "./authorityCommandPolicy";
import type { SaveAuthorityCategoryEstimateCommand } from "./decodeSaveAuthorityCategoryEstimateCommand";
import { decodeSaveAuthorityCategoryEstimateCommand } from "./decodeSaveAuthorityCategoryEstimateCommand";

const base: SaveAuthorityCategoryEstimateCommand = {
  projectId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  inputs: {
    region: "London",
    property_condition: "Dated",
    finish_quality: "Standard",
    selected_categories: ["Bathroom", "Kitchen"],
    property_size_sqm: 90,
  },
  idempotencyKey: "intent-1",
};

describe("hashAuthorityCategoryPayload", () => {
  it("same normalized command → same hash", async () => {
    const a = await hashDecodedCategoryCommand(base);
    const b = await hashDecodedCategoryCommand({ ...base });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("category order does not change hash (canonical order)", async () => {
    const a = await hashDecodedCategoryCommand(base);
    const b = await hashDecodedCategoryCommand({
      ...base,
      inputs: {
        ...base.inputs,
        selected_categories: ["Kitchen", "Bathroom"],
      },
    });
    expect(a).toBe(b);
  });

  it("material input change → different hash", async () => {
    const a = await hashDecodedCategoryCommand(base);
    const b = await hashDecodedCategoryCommand({
      ...base,
      inputs: { ...base.inputs, property_size_sqm: 120 },
    });
    expect(a).not.toBe(b);
  });

  it("policy version change → different hash", async () => {
    const a = await hashAuthorityCategoryPayload({
      projectId: base.projectId,
      inputs: base.inputs,
      pricingPolicyVersion: CATEGORY_PRICING_POLICY_VERSION,
    });
    const b = await hashAuthorityCategoryPayload({
      projectId: base.projectId,
      inputs: base.inputs,
      pricingPolicyVersion: "category-engine-v2",
    });
    expect(a).not.toBe(b);
  });

  it("property order in untrusted object does not change normalized hash", async () => {
    const decodedA = decodeSaveAuthorityCategoryEstimateCommand({
      projectId: base.projectId,
      idempotencyKey: "k",
      inputs: {
        property_size_sqm: 90,
        selected_categories: ["Kitchen", "Bathroom"],
        finish_quality: "Standard",
        property_condition: "Dated",
        region: "London",
      },
    });
    const decodedB = decodeSaveAuthorityCategoryEstimateCommand({
      idempotencyKey: "k",
      inputs: {
        region: "London",
        property_condition: "Dated",
        finish_quality: "Standard",
        selected_categories: ["Kitchen", "Bathroom"],
        property_size_sqm: 90,
      },
      projectId: base.projectId,
    });
    expect(await hashDecodedCategoryCommand(decodedA)).toBe(
      await hashDecodedCategoryCommand(decodedB),
    );
  });

  it("hash object excludes money and identity fields", () => {
    const obj = buildAuthorityCategoryHashObject({
      projectId: base.projectId,
      inputs: base.inputs,
      pricingPolicyVersion: CATEGORY_PRICING_POLICY_VERSION,
    });
    const json = JSON.stringify(obj);
    expect(json).not.toMatch(/subtotal|mid_total|userId|idempotency/i);
    expect(obj.authorityOperation).toBe("category-engine");
  });
});
