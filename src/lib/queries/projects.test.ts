import { describe, it, expect } from "vitest";
import { projectKeys } from "./projects";

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
