/**
 * P1 — project-scoped Analysis notifications.
 * N1/N2/N5/N6 plus failed-save silence and cache-hit load silence.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RoomAnalysis } from "../../domain";
import type { Tables } from "@repo/supabase";

const { getUser, rpc, from, fetchProjectPhotosList, onChange } = vi.hoisted(() => ({
  getUser: vi.fn(() => ({ id: "user-1" }) as { id: string } | null),
  rpc: vi.fn(),
  from: vi.fn(),
  fetchProjectPhotosList: vi.fn(async () => []),
  onChange: vi.fn(() => () => undefined),
}));

vi.mock("@/platform/supabase/browser", () => ({
  supabase: { rpc, from },
}));

vi.mock("@/lib/auth", () => ({
  auth: { getUser, onChange },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/queries/projects", () => ({
  fetchProjectPhotosList,
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));

import { auth } from "@/lib/auth";
import { SupabaseRoomAnalysisRepository } from "./room-analysis.repository";

const authCacheClear = vi.mocked(auth.onChange).mock.calls[0]?.[0];

function durableRow(projectId: string, photoId: string): Tables<"room_analyses"> {
  return {
    id: `row-${photoId}`,
    project_id: projectId,
    user_id: "user-1",
    photo_id: photoId,
    photo_url: `https://cdn/${photoId}.jpg`,
    photo_name: `${photoId}.jpg`,
    room_type: "Other",
    condition_level: "Average",
    refurbishment_level: "Medium",
    visible_issues: [],
    recommended_works: [],
    ai_summary: "ok",
    confidence_score: 0.8,
    source: "ai",
    created_at: "2026-01-01T00:00:00Z",
  } as Tables<"room_analyses">;
}

function aiAnalysis(photoId: string): RoomAnalysis {
  return {
    id: `tmp-${photoId}`,
    photo_id: photoId,
    photo_url: `https://cdn/${photoId}.jpg`,
    photo_name: `${photoId}.jpg`,
    room_type: "Other",
    condition_level: "Average",
    refurbishment_level: "Medium",
    visible_issues: [],
    recommended_works: [],
    ai_summary: "ok",
    confidence_score: 0.8,
    source: "ai",
  };
}

function mockLoadRows(rows: Tables<"room_analyses">[]): void {
  from.mockReturnValueOnce({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: rows, error: null }),
  });
}

function mockSuccessfulSave(row: Tables<"room_analyses">): void {
  rpc.mockResolvedValueOnce({ data: [row], error: null });
}

describe("RoomAnalysisRepository project-scoped notifications", () => {
  const unsubscribers: Array<() => void> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockReturnValue({ id: "user-1" });
    fetchProjectPhotosList.mockResolvedValue([]);
    unsubscribers.length = 0;
  });

  afterEach(() => {
    while (unsubscribers.length) unsubscribers.pop()?.();
    vi.useRealTimers();
  });

  it("N1/N2: load cache-fill notifies only that project", async () => {
    const repo = new SupabaseRoomAnalysisRepository();
    const a = vi.fn();
    const b = vi.fn();
    unsubscribers.push(repo.subscribe("notify-load-a", a), repo.subscribe("notify-load-b", b));

    mockLoadRows([durableRow("notify-load-a", "p1")]);
    await repo.load("notify-load-a");

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it("N1/N2: successful save notifies only that project", async () => {
    const repo = new SupabaseRoomAnalysisRepository();
    const a = vi.fn();
    const b = vi.fn();
    unsubscribers.push(repo.subscribe("notify-save-a", a), repo.subscribe("notify-save-b", b));

    mockSuccessfulSave(durableRow("notify-save-a", "p1"));
    await repo.save("notify-save-a", [aiAnalysis("p1")]);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it("N1/N2: runMock notifies only that project", async () => {
    vi.useFakeTimers();
    const repo = new SupabaseRoomAnalysisRepository();
    const a = vi.fn();
    const b = vi.fn();
    unsubscribers.push(repo.subscribe("notify-mock-a", a), repo.subscribe("notify-mock-b", b));

    const pending = repo.runMock("notify-mock-a");
    await vi.advanceTimersByTimeAsync(1200);
    await pending;

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it("failed save does not notify any subscriber", async () => {
    const repo = new SupabaseRoomAnalysisRepository();
    const a = vi.fn();
    const b = vi.fn();
    unsubscribers.push(repo.subscribe("notify-fail-a", a), repo.subscribe("notify-fail-b", b));

    rpc.mockResolvedValueOnce({ data: null, error: { message: "insert failed" } });
    await expect(repo.save("notify-fail-a", [aiAnalysis("p1")])).rejects.toThrow(
      /insert failed|Failed to save/,
    );

    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it("cached load does not notify again", async () => {
    const repo = new SupabaseRoomAnalysisRepository();
    const a = vi.fn();
    unsubscribers.push(repo.subscribe("notify-cached-a", a));

    mockLoadRows([durableRow("notify-cached-a", "p1")]);
    await repo.load("notify-cached-a");
    expect(a).toHaveBeenCalledTimes(1);

    await repo.load("notify-cached-a");
    expect(a).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("N5: auth cache clear notifies every currently registered listener exactly once", () => {
    expect(authCacheClear).toEqual(expect.any(Function));
    const repo = new SupabaseRoomAnalysisRepository();
    const a = vi.fn();
    const b = vi.fn();
    const a2 = vi.fn();
    unsubscribers.push(
      repo.subscribe("notify-auth-a", a),
      repo.subscribe("notify-auth-b", b),
      repo.subscribe("notify-auth-a", a2),
    );

    authCacheClear!(null);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(a2).toHaveBeenCalledTimes(1);
  });

  it("N6: unsubscribe removes only the intended registration", async () => {
    const repo = new SupabaseRoomAnalysisRepository();
    const a1 = vi.fn();
    const a2 = vi.fn();
    const b = vi.fn();
    const unsubA1 = repo.subscribe("notify-unsub-a", a1);
    unsubscribers.push(repo.subscribe("notify-unsub-a", a2), repo.subscribe("notify-unsub-b", b));

    unsubA1();

    mockSuccessfulSave(durableRow("notify-unsub-a", "p1"));
    await repo.save("notify-unsub-a", [aiAnalysis("p1")]);
    mockSuccessfulSave(durableRow("notify-unsub-b", "p2"));
    await repo.save("notify-unsub-b", [aiAnalysis("p2")]);

    expect(a1).not.toHaveBeenCalled();
    expect(a2).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
