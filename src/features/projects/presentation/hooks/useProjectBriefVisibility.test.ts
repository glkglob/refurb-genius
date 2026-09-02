import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { useAuth } = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => useAuth(),
}));

import {
  PROJECT_BRIEF_VISIBILITY_KEY_PREFIX,
  projectBriefVisibilityKey,
  useProjectBriefVisibility,
} from "./useProjectBriefVisibility";

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "useProjectBriefVisibility.ts"),
  "utf8",
);

describe("useProjectBriefVisibility", () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: { id: "user-a" } });
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("defaults to visible and uses a user-scoped key", () => {
    const { result } = renderHook(() => useProjectBriefVisibility());
    expect(result.current.visible).toBe(true);
    expect(projectBriefVisibilityKey("user-a")).toBe(
      `${PROJECT_BRIEF_VISIBILITY_KEY_PREFIX}user-a`,
    );
    expect(SRC).not.toMatch(
      /localStorage\.(get|set)Item\(\s*["']refurb-genius:dashboard:project-brief-visible["']/,
    );
    expect(SRC).toMatch(/resolvedUserId !== currentUserId \? true/);
  });

  it("hides, restores, and persists between sessions", () => {
    const first = renderHook(() => useProjectBriefVisibility());
    act(() => {
      first.result.current.hide();
    });
    expect(first.result.current.visible).toBe(false);
    expect(window.localStorage.getItem(projectBriefVisibilityKey("user-a"))).toBe("0");
    first.unmount();

    const second = renderHook(() => useProjectBriefVisibility());
    expect(second.result.current.visible).toBe(false);
    act(() => {
      second.result.current.restore();
    });
    expect(second.result.current.visible).toBe(true);
    expect(window.localStorage.getItem(projectBriefVisibilityKey("user-a"))).toBe("1");
  });

  it("does not show the previous user's preference after an identity change", () => {
    window.localStorage.setItem(projectBriefVisibilityKey("user-a"), "0");
    const { result, rerender } = renderHook(() => useProjectBriefVisibility());
    expect(result.current.visible).toBe(false);
    useAuth.mockReturnValue({ user: { id: "user-b" } });
    rerender();
    expect(result.current.visible).toBe(true);
    expect(window.localStorage.getItem(projectBriefVisibilityKey("user-a"))).toBe("0");
  });

  it("treats malformed values as visible", () => {
    window.localStorage.setItem(projectBriefVisibilityKey("user-a"), "maybe");
    const { result } = renderHook(() => useProjectBriefVisibility());
    expect(result.current.visible).toBe(true);
  });

  it("does not read or write storage when there is no user", () => {
    useAuth.mockReturnValue({ user: null });
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { result } = renderHook(() => useProjectBriefVisibility());
    expect(result.current.visible).toBe(true);
    act(() => {
      result.current.hide();
    });
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    getItem.mockRestore();
    setItem.mockRestore();
  });

  it("stays visible when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useProjectBriefVisibility());
    expect(result.current.visible).toBe(true);
  });

  it("does not set state during render", () => {
    expect(SRC).not.toMatch(/if \(userId !== seen/);
    expect(SRC).toMatch(/useEffect/);
  });
});
