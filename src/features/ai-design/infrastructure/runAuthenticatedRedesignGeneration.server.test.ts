import { describe, expect, it, vi, beforeEach } from "vitest";
import { PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS, PhotoAnalysisError } from "@/features/ai-upload";

const resolveCurrentProjectAnalysisAuthorityWithClient = vi.fn();
const runSecureRedesignGeneration = vi.fn();
const replaceRedesignCandidatesWithClient = vi.fn();

vi.mock("./resolveProjectAnalysisAuthority.server", () => ({
  resolveCurrentProjectAnalysisAuthorityWithClient: (...args: unknown[]) =>
    resolveCurrentProjectAnalysisAuthorityWithClient(...args),
}));

vi.mock("./adapters/ai-redesign.adapter.server", () => ({
  runSecureRedesignGeneration: (...args: unknown[]) => runSecureRedesignGeneration(...args),
}));

vi.mock("./repositories/redesign-concepts.repository.server", () => ({
  replaceRedesignCandidatesWithClient: (...args: unknown[]) =>
    replaceRedesignCandidatesWithClient(...args),
}));

import { runAuthenticatedRedesignGeneration } from "./runAuthenticatedRedesignGeneration.server";
import { checkRateLimit, rateLimitKeyForUser } from "@/lib/rate-limit";

const USER = `user-${crypto.randomUUID()}`;
const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const PHOTO = "11111111-aaaa-4aaa-8aaa-111111111111";

describe("runAuthenticatedRedesignGeneration", () => {
  const supabase = { rpc: vi.fn(), from: vi.fn() };

  beforeEach(() => {
    resolveCurrentProjectAnalysisAuthorityWithClient.mockReset();
    runSecureRedesignGeneration.mockReset();
    replaceRedesignCandidatesWithClient.mockReset();
  });

  it("reads durable Analysis via the injected client, generates, then sealed replace", async () => {
    const analyses = [{ photo_id: PHOTO, source: "ai" }];
    resolveCurrentProjectAnalysisAuthorityWithClient.mockResolvedValue(analyses);
    runSecureRedesignGeneration.mockResolvedValue([{ style: "Modern", tagline: "ok" }]);
    replaceRedesignCandidatesWithClient.mockResolvedValue([
      { id: "c1", isSelected: false, analysisIdentity: PHOTO },
    ]);

    const out = await runAuthenticatedRedesignGeneration({
      userId: USER,
      supabase,
      projectId: PROJECT,
      styles: ["Modern"],
    });

    expect(resolveCurrentProjectAnalysisAuthorityWithClient).toHaveBeenCalledWith(supabase, {
      userId: USER,
      projectId: PROJECT,
    });
    expect(runSecureRedesignGeneration).toHaveBeenCalledWith({
      projectId: PROJECT,
      styles: ["Modern"],
      analyses,
    });
    expect(replaceRedesignCandidatesWithClient).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ projectId: PROJECT }),
    );
    expect(out).toHaveLength(1);
  });

  it("does not persist when Analysis authority fails", async () => {
    resolveCurrentProjectAnalysisAuthorityWithClient.mockRejectedValue(
      new PhotoAnalysisError(PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS, "stale"),
    );
    await expect(
      runAuthenticatedRedesignGeneration({ userId: USER, supabase, projectId: PROJECT }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS });
    expect(runSecureRedesignGeneration).not.toHaveBeenCalled();
    expect(replaceRedesignCandidatesWithClient).not.toHaveBeenCalled();
  });

  it("does not persist when AI generation fails", async () => {
    resolveCurrentProjectAnalysisAuthorityWithClient.mockResolvedValue([{ photo_id: PHOTO }]);
    runSecureRedesignGeneration.mockRejectedValue(new Error("provider down"));
    await expect(
      runAuthenticatedRedesignGeneration({ userId: USER, supabase, projectId: PROJECT }),
    ).rejects.toThrow(/provider down/);
    expect(replaceRedesignCandidatesWithClient).not.toHaveBeenCalled();
  });

  it("uses the same ai-redesign rate-limit bucket", async () => {
    const key = rateLimitKeyForUser(`${USER}-rl`, "ai-redesign");
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(key).allowed).toBe(true);
    }
    resolveCurrentProjectAnalysisAuthorityWithClient.mockResolvedValue([{ photo_id: PHOTO }]);
    await expect(
      runAuthenticatedRedesignGeneration({
        userId: `${USER}-rl`,
        supabase,
        projectId: PROJECT,
      }),
    ).rejects.toThrow(/Rate limit exceeded/);
    expect(runSecureRedesignGeneration).not.toHaveBeenCalled();
  });
});
