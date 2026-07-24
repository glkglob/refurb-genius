/**
 * Verified data lineage / request flows (not aspirational multi-app diagrams).
 */
export type DataFlow = {
  id: string;
  label: string;
  steps: string[];
  evidence: string[];
};

export const DATA_FLOWS: DataFlow[] = [
  {
    id: "project-photo-estimate",
    label: "Project photo → analysis → estimate (Refurb Genius)",
    steps: [
      "UI route/component",
      "feature presentation or transitional lib store",
      "application use case (feature) where present",
      "infrastructure repository / lib photos",
      "platform Supabase browser client",
      "Postgres photos + Storage project-photos",
      "AI adapter (server) → platform OpenAI/HF",
      "persist analysis/estimate rows",
    ],
    evidence: [
      "src/features/ai-upload",
      "src/features/estimate",
      "src/lib/photos.ts",
      "src/platform/supabase",
    ],
  },
  {
    id: "deal-copilot-chat",
    label: "Deal Copilot chat message",
    steps: [
      "UI DealChat",
      "serverFn dealChat",
      "createServerSupabase / session",
      "deal_threads / deal_messages tables",
      "dealChat.adapter.server → getOpenAIClient",
      "persist assistant message",
    ],
    evidence: [
      "src/components/deal-copilot/DealChat.tsx",
      "src/serverFns/dealChat.ts",
      "src/core/dealCopilot/server/dealChat.adapter.server.ts",
    ],
  },
  {
    id: "deal-opportunity-save",
    label: "Deal opportunity save",
    steps: [
      "UI intake",
      "opportunityStore / saveDealOpportunityServerFn",
      "serverFn dealCopilot",
      "deal_opportunities RLS user_id",
    ],
    evidence: ["src/core/dealCopilot/opportunityStore.ts", "src/serverFns/dealCopilot.ts"],
  },
  {
    id: "financial-pure",
    label: "Pricing / ROI computation (no DB authority)",
    steps: [
      "UI / deal analysis helper",
      "@repo/services runPricingEngine",
      "pricing.mid_total",
      "runRoiEngine / scoreDealOpportunity",
      "optional display or study snapshot persistence",
    ],
    evidence: ["packages/services", "src/lib/deal-copilot/dealAnalysis.ts"],
  },
  {
    id: "auth-signup",
    label: "Email signup → profile",
    steps: [
      "AuthExperience UI",
      "supabase.auth.signUp",
      "auth.users insert",
      "handle_new_user trigger",
      "profiles row (full_name, company from metadata)",
    ],
    evidence: [
      "src/features/auth/presentation/AuthExperience.tsx",
      "supabase/migrations/20260513093000_admin-role-system.sql",
      "supabase/migrations/20260724000000_profile_company_from_signup_metadata.sql",
    ],
  },
  {
    id: "trades-interest",
    label: "Trades job interest",
    steps: [
      "Public/auth trades route",
      "src/services/trades stores",
      "platform supabase browser",
      "trades_jobs / trades_job_interests RLS",
    ],
    evidence: ["src/services/trades", "src/routes/trades.tsx"],
  },
];
