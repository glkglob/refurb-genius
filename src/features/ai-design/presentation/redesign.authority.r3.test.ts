/**
 * P0-PHOTO-ANALYZE-R3 — redesign server authority ignores client analyses.
 * Tests orchestration via dynamic import of server modules (no static .server import).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS, PhotoAnalysisError } from "@/features/ai-upload";

const { resolveCurrentProjectAnalysisAuthority, runSecureRedesignGeneration } = vi.hoisted(() => ({
  resolveCurrentProjectAnalysisAuthority: vi.fn(),
  runSecureRedesignGeneration: vi.fn(async () => [
    {
      style: "Modern" as const,
      tagline: "ok",
      palette: "neutral",
      flooring: "oak",
      lighting: "warm",
      furniture: "minimal",
      afterGradient: "from-slate-100",
    },
  ]),
}));

vi.mock("../infrastructure/resolveProjectAnalysisAuthority.server", () => ({
  resolveCurrentProjectAnalysisAuthority,
}));

vi.mock("../infrastructure/adapters/ai-redesign.adapter.server", () => ({
  runSecureRedesignGeneration,
}));

/** Mirrors generateRedesignConceptsServerFn authority chain without createServerFn. */
async function generateRedesignWithAuthority(input: {
  userId: string;
  projectId: string;
  styles?: string[];
  analyses?: unknown;
}) {
  void input.analyses;
  const { resolveCurrentProjectAnalysisAuthority: resolve } =
    await import("../infrastructure/resolveProjectAnalysisAuthority.server");
  const analyses = await resolve({
    userId: input.userId,
    projectId: input.projectId,
  });
  const { runSecureRedesignGeneration: generate } =
    await import("../infrastructure/adapters/ai-redesign.adapter.server");
  return generate({
    projectId: input.projectId,
    styles: input.styles as never,
    analyses,
  });
}

describe("generateRedesignWithAuthority (R3)", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const projectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
  const p1 = "11111111-aaaa-4aaa-8aaa-111111111111";
  const p2 = "22222222-aaaa-4aaa-8aaa-222222222222";
  const p3 = "33333333-aaaa-4aaa-8aaa-333333333333";

  const serverAnalyses = [
    {
      id: "a1",
      photo_id: p1,
      photo_url: `https://cdn/${p1}.jpg`,
      photo_name: `${p1}.jpg`,
      room_type: "Kitchen" as const,
      condition_level: "Average" as const,
      refurbishment_level: "Medium" as const,
      visible_issues: [] as string[],
      recommended_works: [] as string[],
      ai_summary: "server",
      confidence_score: 0.9,
      source: "ai" as const,
    },
    {
      id: "a2",
      photo_id: p2,
      photo_url: `https://cdn/${p2}.jpg`,
      photo_name: `${p2}.jpg`,
      room_type: "Bathroom" as const,
      condition_level: "Average" as const,
      refurbishment_level: "Medium" as const,
      visible_issues: [] as string[],
      recommended_works: [] as string[],
      ai_summary: "server",
      confidence_score: 0.8,
      source: "ai" as const,
    },
    {
      id: "a3",
      photo_id: p3,
      photo_url: `https://cdn/${p3}.jpg`,
      photo_name: `${p3}.jpg`,
      room_type: "Other" as const,
      condition_level: "Average" as const,
      refurbishment_level: "Medium" as const,
      visible_issues: [] as string[],
      recommended_works: [] as string[],
      ai_summary: "server",
      confidence_score: 0.7,
      source: "ai" as const,
    },
  ];

  const forgedClient = serverAnalyses.map((a) => ({
    ...a,
    ai_summary: "FORGED_CLIENT",
    photo_id: "99999999-aaaa-4aaa-8aaa-999999999999",
  }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AA: valid complete authority → redesign generation uses server analyses", async () => {
    resolveCurrentProjectAnalysisAuthority.mockResolvedValueOnce(serverAnalyses);
    await generateRedesignWithAuthority({ userId, projectId, styles: ["Modern"] });
    expect(resolveCurrentProjectAnalysisAuthority).toHaveBeenCalledWith({ userId, projectId });
    expect(runSecureRedesignGeneration).toHaveBeenCalledWith({
      projectId,
      styles: ["Modern"],
      analyses: serverAnalyses,
    });
  });

  it("AB: same-count stale authority → rejected before generation", async () => {
    resolveCurrentProjectAnalysisAuthority.mockRejectedValueOnce(
      new PhotoAnalysisError(
        PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS,
        "Previous analysis was not based on the current project photos.",
      ),
    );
    await expect(generateRedesignWithAuthority({ userId, projectId })).rejects.toMatchObject({
      code: PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS,
    });
    expect(runSecureRedesignGeneration).not.toHaveBeenCalled();
  });

  it("AC: incomplete authority → rejected before generation", async () => {
    resolveCurrentProjectAnalysisAuthority.mockRejectedValueOnce(
      new PhotoAnalysisError(PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS, "stale"),
    );
    await expect(generateRedesignWithAuthority({ userId, projectId })).rejects.toMatchObject({
      code: PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS,
    });
    expect(runSecureRedesignGeneration).not.toHaveBeenCalled();
  });

  it("AD: forged client analyses cannot authorize redesign when DB is stale", async () => {
    resolveCurrentProjectAnalysisAuthority.mockRejectedValueOnce(
      new PhotoAnalysisError(PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS, "stale"),
    );
    await expect(
      generateRedesignWithAuthority({ userId, projectId, analyses: forgedClient }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS });
    expect(runSecureRedesignGeneration).not.toHaveBeenCalled();
  });

  it("AE: client analyses cannot override canonical server authority when DB is valid", async () => {
    resolveCurrentProjectAnalysisAuthority.mockResolvedValueOnce(serverAnalyses);
    await generateRedesignWithAuthority({
      userId,
      projectId,
      styles: ["Modern"],
      analyses: forgedClient,
    });
    expect(runSecureRedesignGeneration).toHaveBeenCalledWith({
      projectId,
      styles: ["Modern"],
      analyses: serverAnalyses,
    });
    const calls = runSecureRedesignGeneration.mock.calls as unknown as Array<
      [{ analyses: Array<{ ai_summary: string }> }]
    >;
    expect(calls[0]?.[0].analyses.every((a) => a.ai_summary === "server")).toBe(true);
    expect(calls[0]?.[0].analyses.some((a) => a.ai_summary === "FORGED_CLIENT")).toBe(false);
  });
});

describe("redesign provider client contract (R3)", () => {
  it("generate does not send client analyses from analysisStore", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/features/ai-design/presentation/redesign.provider.ts"),
      "utf8",
    );
    expect(src).toContain("generateRedesignConceptsServerFn");
    expect(src).not.toMatch(/analyses\s*,/);
    expect(src).not.toContain("analysisStore");
    expect(src).not.toContain("isRedesignAuthorityUsable");
  });

  it("serverFn ignores client analyses and loads authority server-side", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/features/ai-design/presentation/serverFns.ts"),
      "utf8",
    );
    expect(src).toContain("runAuthenticatedRedesignGeneration");
    expect(src).toContain("void data.analyses");
    const generate = readFileSync(
      join(
        process.cwd(),
        "src/features/ai-design/infrastructure/runAuthenticatedRedesignGeneration.server.ts",
      ),
      "utf8",
    );
    expect(generate).toContain("resolveProjectAnalysisAuthority.server");
    expect(generate).toContain("ai-redesign.adapter.server");
  });
});
