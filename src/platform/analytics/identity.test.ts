import { describe, it, expect } from "vitest";
import { ANALYTICS_IDENTITY_UNRESOLVED, planAnalyticsIdentityTransition } from "./identity";

describe("planAnalyticsIdentityTransition", () => {
  it("UNRESOLVED → anonymous: noop, no reset", () => {
    expect(planAnalyticsIdentityTransition(ANALYTICS_IDENTITY_UNRESOLVED, null)).toEqual({
      action: "noop",
      next: null,
    });
  });

  it("UNRESOLVED → authenticated: identify once", () => {
    expect(planAnalyticsIdentityTransition(ANALYTICS_IDENTITY_UNRESOLVED, "user-a")).toEqual({
      action: "identify",
      next: "user-a",
      userId: "user-a",
    });
  });

  it("anonymous → authenticated: identify once", () => {
    expect(planAnalyticsIdentityTransition(null, "user-a")).toEqual({
      action: "identify",
      next: "user-a",
      userId: "user-a",
    });
  });

  it("same user: noop (no duplicate identify)", () => {
    expect(planAnalyticsIdentityTransition("user-a", "user-a")).toEqual({
      action: "noop",
      next: "user-a",
    });
  });

  it("authenticated → signed out: reset", () => {
    expect(planAnalyticsIdentityTransition("user-a", null)).toEqual({
      action: "reset",
      next: null,
    });
  });

  it("USER A → USER B: reset then identify", () => {
    expect(planAnalyticsIdentityTransition("user-a", "user-b")).toEqual({
      action: "reset_then_identify",
      next: "user-b",
      userId: "user-b",
    });
  });

  it("signed out → signed out: noop", () => {
    expect(planAnalyticsIdentityTransition(null, null)).toEqual({
      action: "noop",
      next: null,
    });
  });
});
