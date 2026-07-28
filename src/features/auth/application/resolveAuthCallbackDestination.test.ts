/**
 * AO-1F1 — Auth callback destination resolver contracts.
 *
 * Probes document exact pre-extraction parity, including the preserved
 * protocol-relative acceptance of //evil.example (adjacent open-redirect debt).
 */
import { describe, it, expect } from "vitest";
import { resolveAuthCallbackDestination } from "./resolveAuthCallbackDestination";

describe("resolveAuthCallbackDestination", () => {
  it.each([
    { input: undefined, expected: "/dashboard", label: "undefined" },
    { input: "", expected: "/dashboard", label: "empty string" },
    { input: "/dashboard", expected: "/dashboard", label: "dashboard path" },
    { input: "/projects/123", expected: "/projects/123", label: "nested path" },
    { input: "/auth", expected: "/auth", label: "auth path accepted (weaker than AuthExperience)" },
    {
      input: "/auth?mode=signin",
      expected: "/auth?mode=signin",
      label: "auth path with query",
    },
    {
      input: "https://example.com",
      expected: "/dashboard",
      label: "absolute https rejected",
    },
    {
      // Preserved parity: protocol-relative starts with "/" so it is accepted.
      // Adjacent open-redirect debt — do not "fix" in AO-1F1.
      input: "//evil.example",
      expected: "//evil.example",
      label: "protocol-relative accepted (preserved open-redirect parity)",
    },
    {
      input: "javascript:alert(1)",
      expected: "/dashboard",
      label: "javascript: rejected",
    },
    { input: "projects", expected: "/dashboard", label: "relative without slash" },
    { input: " ", expected: "/dashboard", label: "single space" },
    { input: "/a?b=1", expected: "/a?b=1", label: "path with query" },
    { input: "/a#section", expected: "/a#section", label: "path with hash" },
  ])("$label → $expected", ({ input, expected }) => {
    expect(resolveAuthCallbackDestination(input)).toBe(expected);
  });
});
