import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/platform/sentry/server-capture", () => ({
  captureAiError: vi.fn(),
  addDiagnosticBreadcrumb: vi.fn(),
  setConversationId: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/provider-diagnostics", () => ({
  incrementCounter: vi.fn(),
}));
vi.mock("@/lib/timeout", () => ({
  timeoutPromise: vi.fn(async (p: Promise<unknown>) => p),
  isTimeoutError: () => false,
}));
vi.mock("@/core/ai/platform/retry", () => ({
  withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));

const { create, createSignedUrl, fromMock, requireUser, createSupabaseServerClient } = vi.hoisted(
  () => {
    const create = vi.fn();
    const createSignedUrl = vi.fn();
    const fromMock = vi.fn();
    const requireUser = vi.fn(async () => ({ id: "user-1" }));
    const createSupabaseServerClient = vi.fn(async () => ({
      from: fromMock,
      storage: { from: () => ({ createSignedUrl }) },
    }));
    return { create, createSignedUrl, fromMock, requireUser, createSupabaseServerClient };
  },
);

vi.mock("@/platform/openai/server", () => ({
  getOpenAIClient: () => ({ chat: { completions: { create } } }),
}));

vi.mock("@/serverFns/auth.server", () => ({
  requireUser,
  createSupabaseServerClient,
}));

function chain(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const inFn = vi.fn().mockResolvedValue(result);
  const eq2 = vi.fn(() => ({ maybeSingle, in: inFn }));
  const eq1 = vi.fn(() => ({ eq: eq2, maybeSingle, in: inFn }));
  return { select: vi.fn(() => ({ eq: eq1 })), maybeSingle, in: inFn };
}

const PROJECT = "11111111-1111-1111-1111-111111111111";
const PHOTO = "22222222-2222-2222-2222-222222222222";
const DURABLE = "https://cdn.example/object/public/project-photos/u/p.jpg";
const CLIENT_URL = "https://evil.example/stolen.jpg";
const SIGNED = "https://cdn.example/object/sign/project-photos/u/p.jpg?token=scope";

describe("runSecureScopeAnalysis retrieval authority", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("re-resolves by id, signs storage_path at TTL 300, and ignores client URL", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");

    const projectChain = chain({ data: { id: PROJECT }, error: null });
    const photoChain = chain({
      data: [
        {
          id: PHOTO,
          url: DURABLE,
          name: "room.jpg",
          storage_path: "user-1/proj/p.jpg",
          project_id: PROJECT,
          user_id: "user-1",
        },
      ],
      error: null,
    });
    fromMock.mockImplementation((table: string) =>
      table === "projects" ? projectChain : photoChain,
    );
    createSignedUrl.mockResolvedValue({ data: { signedUrl: SIGNED }, error: null });
    create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              overall_score: 6,
              summary: "Average condition terrace needing a medium refresh.",
              rooms: [
                {
                  room: "Kitchen",
                  condition_summary: "Dated but serviceable",
                  issues: [
                    {
                      category: "Cosmetic",
                      description: "Worn units",
                      severity: "medium",
                      recommended_action: "Replace units",
                    },
                  ],
                  recommended_items: [
                    {
                      name: "Replace mid-range kitchen units",
                      category: "both",
                      quantity: 1,
                      unit: "room",
                      base_unit_cost: 8000,
                    },
                  ],
                },
              ],
            }),
          },
        },
      ],
    });

    const { runSecureScopeAnalysis } = await import("./ai-scope.adapter.server");
    await runSecureScopeAnalysis({
      projectId: PROJECT,
      photos: [{ id: PHOTO, url: CLIENT_URL, name: "room.jpg" }],
      roomTags: ["Kitchen"],
      propertyType: "Terraced",
      bedrooms: 3,
      region: "London",
    });

    expect(createSignedUrl).toHaveBeenCalledWith("user-1/proj/p.jpg", 300);
    expect(JSON.stringify(create.mock.calls)).toContain(SIGNED);
    expect(JSON.stringify(create.mock.calls)).not.toContain(CLIENT_URL);
    expect(JSON.stringify(create.mock.calls)).not.toContain(DURABLE);
    expect(requireUser).toHaveBeenCalled();
  }, 15_000);

  it("uses injected auth and does not call cookie requireUser", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");

    const projectChain = chain({ data: { id: PROJECT }, error: null });
    const photoChain = chain({
      data: [
        {
          id: PHOTO,
          url: DURABLE,
          name: "room.jpg",
          storage_path: "user-1/proj/p.jpg",
          project_id: PROJECT,
          user_id: "user-1",
        },
      ],
      error: null,
    });
    fromMock.mockImplementation((table: string) =>
      table === "projects" ? projectChain : photoChain,
    );
    createSignedUrl.mockResolvedValue({ data: { signedUrl: SIGNED }, error: null });
    create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              overall_score: 6,
              summary: "Average condition terrace needing a medium refresh.",
              rooms: [
                {
                  room: "Kitchen",
                  condition_summary: "Dated but serviceable",
                  issues: [
                    {
                      category: "Cosmetic",
                      description: "Worn units",
                      severity: "medium",
                      recommended_action: "Replace units",
                    },
                  ],
                  recommended_items: [
                    {
                      name: "Replace mid-range kitchen units",
                      category: "both",
                      quantity: 1,
                      unit: "room",
                      base_unit_cost: 8000,
                    },
                  ],
                },
              ],
            }),
          },
        },
      ],
    });

    const supabase = {
      from: fromMock,
      storage: { from: () => ({ createSignedUrl }) },
    };
    const { runSecureScopeAnalysis } = await import("./ai-scope.adapter.server");
    await runSecureScopeAnalysis(
      {
        projectId: PROJECT,
        photos: [{ id: PHOTO, url: CLIENT_URL, name: "room.jpg" }],
        roomTags: ["Kitchen"],
        propertyType: "Terraced",
        bedrooms: 3,
        region: "London",
      },
      { userId: "user-1", supabase },
    );

    expect(requireUser).not.toHaveBeenCalled();
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    expect(createSignedUrl).toHaveBeenCalledWith("user-1/proj/p.jpg", 300);
  }, 15_000);
});
