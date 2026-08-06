/**
 * P0-AUTH-1 — Auth callback destination resolver contracts.
 */
import { describe, it, expect } from "vitest";
import { resolveAuthCallbackDestination } from "./resolveAuthCallbackDestination";

describe("resolveAuthCallbackDestination", () => {
  it.each([
    { input: undefined, expected: "/dashboard", label: "undefined" },
    { input: "", expected: "/dashboard", label: "empty string" },
    { input: "/projects", expected: "/projects", label: "projects path" },
    { input: "/dashboard", expected: "/dashboard", label: "dashboard path" },
    {
      input: "/dashboard?tab=recent",
      expected: "/dashboard?tab=recent",
      label: "dashboard with query",
    },
    { input: "/projects/123", expected: "/projects/123", label: "nested path" },
    { input: "/a?b=1", expected: "/a?b=1", label: "path with query" },
    { input: "/a#section", expected: "/a#section", label: "path with hash" },
    {
      input: "https://evil.example",
      expected: "/dashboard",
      label: "absolute https rejected",
    },
    {
      input: "//evil.example",
      expected: "/dashboard",
      label: "protocol-relative rejected",
    },
    {
      input: "/auth",
      expected: "/dashboard",
      label: "auth path rejected",
    },
    {
      input: "/auth?mode=signin",
      expected: "/dashboard",
      label: "auth path with query rejected",
    },
    {
      input: "/auth/callback",
      expected: "/dashboard",
      label: "auth nested path rejected",
    },
    {
      input: "javascript:alert(1)",
      expected: "/dashboard",
      label: "javascript: rejected",
    },
    { input: "projects", expected: "/dashboard", label: "relative without slash" },
    { input: " ", expected: "/dashboard", label: "single space" },
  ])("$label → $expected", ({ input, expected }) => {
    expect(resolveAuthCallbackDestination(input)).toBe(expected);
  });
});
