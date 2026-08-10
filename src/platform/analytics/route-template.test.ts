import { describe, it, expect } from "vitest";
import {
  buildSafePageviewUrl,
  deriveRouteTemplateFromMatches,
  normalizeRouteTemplate,
  redactDynamicSegments,
} from "./route-template";

describe("normalizeRouteTemplate", () => {
  it("strips pathless _authed layout", () => {
    expect(normalizeRouteTemplate("/_authed/dashboard")).toBe("/dashboard");
    expect(normalizeRouteTemplate("/_authed/projects/$id/estimate")).toBe("/projects/$id/estimate");
  });

  it("normalizes trades_ file-route ids", () => {
    expect(normalizeRouteTemplate("/trades_/$jobId")).toBe("/trades/$jobId");
    expect(normalizeRouteTemplate("/auth_/callback")).toBe("/auth/callback");
  });

  it("collapses trailing slashes", () => {
    expect(normalizeRouteTemplate("/projects/")).toBe("/projects");
    expect(normalizeRouteTemplate("/")).toBe("/");
  });
});

describe("deriveRouteTemplateFromMatches", () => {
  it("uses deepest fullPath template", () => {
    const template = deriveRouteTemplateFromMatches([
      { routeId: "/_authed", fullPath: undefined },
      { routeId: "/projects/$id/", fullPath: "/projects/$id/" },
      { routeId: "/projects/$id/estimate", fullPath: "/projects/$id/estimate" },
    ]);
    expect(template).toBe("/projects/$id/estimate");
  });

  it("returns /404 for not-found", () => {
    expect(deriveRouteTemplateFromMatches([], { isNotFound: true })).toBe("/404");
    expect(deriveRouteTemplateFromMatches([{ routeId: "/unknown", isNotFound: true }])).toBe(
      "/404",
    );
  });

  it("redacts UUIDs if only resolved pathname is available", () => {
    const id = "10fe6c5b-905b-42b6-abac-fb313728bd67";
    const template = deriveRouteTemplateFromMatches([
      {
        routeId: `/projects/${id}/estimate`,
        fullPath: undefined,
        pathname: `/projects/${id}/estimate`,
      },
    ]);
    expect(template).not.toContain(id);
    expect(template).toContain("$id");
  });
});

describe("redactDynamicSegments / buildSafePageviewUrl", () => {
  it("redacts uuid segments", () => {
    expect(redactDynamicSegments("/projects/10fe6c5b-905b-42b6-abac-fb313728bd67/estimate")).toBe(
      "/projects/$id/estimate",
    );
  });

  it("builds origin + template URL without query/hash", () => {
    expect(buildSafePageviewUrl("https://www.refurbgenius.info", "/projects/$id")).toBe(
      "https://www.refurbgenius.info/projects/$id",
    );
  });

  it("redacts every consecutive call (no global RegExp lastIndex alternation)", () => {
    const id1 = "11111111-2222-4333-8444-555555555555";
    const id2 = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const inputs = [
      `/projects/${id1}/estimate`,
      `/projects/${id2}/estimate`,
      `/projects/${id1}/estimate`,
      `/trades/${id2}`,
      `/projects/${id1}`,
      `/deal-copilot/${id2}`,
    ];
    for (const input of inputs) {
      const out = redactDynamicSegments(input);
      expect(out).not.toContain(id1);
      expect(out).not.toContain(id2);
      expect(out).toMatch(/\$id/);
    }

    // deriveRouteTemplateFromMatches fallback path (routeId with UUID, no fullPath)
    for (let i = 0; i < 20; i++) {
      const id = i % 2 === 0 ? id1 : id2;
      const template = deriveRouteTemplateFromMatches([{ routeId: `/projects/${id}/estimate` }]);
      expect(template).not.toContain(id1);
      expect(template).not.toContain(id2);
      expect(template).toBe("/projects/$id/estimate");
    }
  });
});
