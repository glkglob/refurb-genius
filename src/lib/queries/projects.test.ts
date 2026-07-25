import { describe, it, expect } from "vitest";
import { projectKeys, projectQueryOptions } from "./projects";

describe("projectKeys (C4c-1 serialized identity)", () => {
  it('list root is exactly ["projects"]', () => {
    expect(projectKeys.all).toEqual(["projects"]);
    expect(JSON.stringify(projectKeys.all)).toBe(JSON.stringify(["projects"]));
  });

  it("byId nests under the list root", () => {
    expect(projectKeys.byId("abc")).toEqual(["projects", "abc"]);
  });

  it("nested resource keys remain descendants of byId", () => {
    expect(projectKeys.photosByProject("abc")).toEqual(["projects", "abc", "photos"]);
    expect(projectKeys.estimateByProject("abc")).toEqual(["projects", "abc", "estimate"]);
  });

  it("does not introduce list/detail segments or user scoping", () => {
    expect(projectKeys.all).not.toContain("list");
    expect(projectKeys.all).not.toContain("detail");
    expect(projectKeys.byId("abc")).not.toContain("list");
    expect(projectKeys.byId("abc")).not.toContain("detail");
  });
});

describe("projectQueryOptions (C4c-2 canonical detail authority)", () => {
  it("queryKey equals projectKeys.byId(id)", () => {
    const id = "proj-123";
    expect(projectQueryOptions(id).queryKey).toEqual(projectKeys.byId(id));
  });

  it('queryKey serializes as ["projects", id]', () => {
    const id = "proj-123";
    expect(projectQueryOptions(id).queryKey).toEqual(["projects", id]);
    expect(JSON.stringify(projectQueryOptions(id).queryKey)).toBe(JSON.stringify(["projects", id]));
  });

  it("enabled is true for a non-empty id", () => {
    expect(projectQueryOptions("proj-123").enabled).toBe(true);
  });

  it("enabled is false for an empty id", () => {
    expect(projectQueryOptions("").enabled).toBe(false);
  });

  it("uses stable detail-view cache defaults", () => {
    const opts = projectQueryOptions("proj-123");
    expect(opts.retry).toBe(1);
    expect(opts.staleTime).toBe(5 * 60 * 1000);
    expect(opts.gcTime).toBe(10 * 60 * 1000);
    expect(opts.refetchOnWindowFocus).toBe(false);
  });
});
