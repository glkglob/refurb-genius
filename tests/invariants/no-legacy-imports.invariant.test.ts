import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const IMPORT_PATTERN = /\b(?:import|export)\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']/g;
const TARGET_DIRS = ["src/routes", "src/hooks", "src/components", "src/serverFns"] as const;
const FORBIDDEN_PREFIXES = ["@/core/", "@/lib/", "@/services/", "@/integrations/"] as const;
const MIGRATION_GUIDANCE = "@/features/... or @/platform/...";

const BASELINE_ALLOWLIST = new Set<string>([
  "src/components/AIEstimateBuilder.tsx|@/core/ai",
  "src/components/AIEstimateBuilder.tsx|@/core/constants",
  "src/components/AIEstimateBuilder.tsx|@/core/pricing",
  "src/components/AIEstimateBuilder.tsx|@/core/projects",
  "src/components/AIFeedbackWidget.tsx|@/lib/ai-quality-feedback",
  "src/components/AIMetricsDashboard.tsx|@/lib/provider-diagnostics",
  "src/components/AIMetricsDashboard.tsx|@/lib/provider-health-analysis",
  "src/components/AppLayout.tsx|@/core/reports",
  "src/components/Footer.tsx|@/core/reports",
  "src/components/BulkPhotoUpload.tsx|@/lib/auth",
  "src/components/BulkPhotoUpload.tsx|@/lib/logger",
  "src/components/BulkPhotoUpload.tsx|@/lib/queries/projects",
  "src/components/BulkPhotoUpload.tsx|@/lib/sentry",
  "src/components/DashboardSection.tsx|@/lib/utils",
  "src/components/EstimateBuilder.tsx|@/core/constants",
  "src/components/EstimateBuilder.tsx|@/core/pricing",
  "src/components/EstimateBuilder.tsx|@/lib/logger",
  "src/components/EstimateBuilder.tsx|@/lib/mappers",
  "src/components/EstimateBuilder.tsx|@/lib/queries/projects",
  "src/components/EstimateTable.tsx|@/core/pricing",
  "src/components/MetricCard.tsx|@/lib/utils",
  "src/components/MobileTopBar.tsx|@/lib/auth",
  "src/components/PlatformNavButtons.tsx|@/lib/utils",
  "src/components/ProjectCard.tsx|@/core/projects",
  "src/components/RedesignCard.tsx|@/core/pricing",
  "src/components/SensitivityAnalysis.tsx|@/lib/mappers",
  "src/components/SensitivityAnalysis.tsx|@/lib/queries/projects",
  "src/components/Sidebar.tsx|@/lib/auth",
  "src/components/Sidebar.tsx|@/lib/utils",
  "src/components/StatusBadge.tsx|@/lib/utils",
  "src/components/deal-copilot/DealAnalysisCard.tsx|@/core/dealCopilot/dealAnalysis",
  "src/components/deal-copilot/DealAnalysisCard.tsx|@/lib/analytics",
  "src/components/deal-copilot/DealChat.tsx|@/lib/analytics",
  "src/components/deal-copilot/DealChat.tsx|@/serverFns/dealChat",
  "src/components/deal-copilot/DealCopilotFeedback.tsx|@/lib/logger",
  "src/components/deal-copilot/DealEstimateSection.tsx|@/lib/deal-copilot/dealFormatting",
  "src/components/deal-copilot/DealIntakeForm.tsx|@/core/ai",
  "src/components/deal-copilot/DealIntakeForm.tsx|@/core/dealCopilot",
  "src/components/deal-copilot/DealIntakeForm.tsx|@/core/pricing",
  "src/components/deal-copilot/DealIntakeForm.tsx|@/lib/analytics",
  "src/components/deal-copilot/DealIntakeForm.tsx|@/lib/deal-copilot/dealAnalysis",
  "src/components/deal-copilot/DealIntakeForm.tsx|@/lib/deal-copilot/dealValidation",
  "src/components/deal-copilot/DealIntakeForm.tsx|@/lib/logger",
  "src/components/deal-copilot/DealIntakeForm.tsx|@/lib/projects",
  "src/components/deal-copilot/DealIntakeForm.tsx|@/lib/utils",
  "src/components/deal-copilot/DealRiskFlags.tsx|@/lib/deal-copilot/dealFormatting",
  "src/components/deal-copilot/DealScoreCard.tsx|@/lib/deal-copilot/dealFormatting",
  "src/components/deal-copilot/DealMetricsGrid.tsx|@/lib/deal-copilot/dealFormatting",
  "src/components/deal-copilot/DealSummarySection.tsx|@/lib/deal-copilot/dealFormatting",
  "src/components/floorplan/FloorplanScene.tsx|@/lib/floorplan",
  "src/components/floorplan/FloorplanViewer.tsx|@/lib/auth",
  "src/components/floorplan/FloorplanViewer.tsx|@/lib/floorplan",
  "src/components/floorplan/FloorplanViewer.tsx|@/lib/logger",
  "src/components/floorplan/FloorplanViewer.tsx|@/lib/queries/floorplans",
  "src/components/floorplan/FloorplanViewer.tsx|@/lib/queries/projects",
  "src/components/gallery/LeadCaptureForm.tsx|@/core/gallery/serverFns",
  "src/components/gallery/LeadCaptureForm.tsx|@/lib/logger",
  "src/components/gallery/ProjectCard.tsx|@/lib/queries/gallery",
  "src/components/gallery/PublishToGallery.tsx|@/lib/gallery",
  "src/components/gallery/PublishToGallery.tsx|@/lib/logger",
  "src/components/gallery/PublishToGallery.tsx|@/lib/queries/gallery",
  "src/components/marketplace/MessagingInbox.tsx|@/lib/auth",
  "src/components/marketplace/MessagingInbox.tsx|@/lib/logger",
  "src/components/marketplace/MessagingInbox.tsx|@/lib/queries/marketplace",
  "src/components/marketplace/QuoteRequestDialog.tsx|@/lib/auth",
  "src/components/marketplace/QuoteRequestDialog.tsx|@/lib/logger",
  "src/components/marketplace/QuoteRequestDialog.tsx|@/lib/queries/marketplace",
  "src/components/marketplace/TradepersonCard.tsx|@/lib/auth",
  "src/components/marketplace/TradepersonCard.tsx|@/lib/logger",
  "src/components/marketplace/TradepersonCard.tsx|@/lib/queries/marketplace",
  "src/components/marketplace/TradepersonCard.tsx|@/lib/queries/projects",
  "src/components/photos/PhotoAnalysisCard.tsx|@/lib/photos",
  "src/components/photos/PhotoAnalysisCard.tsx|@/lib/queries/photo-analysis",
  "src/components/photos/PhotoAnalysisViewer.tsx|@/lib/logger",
  "src/components/photos/PhotoAnalysisViewer.tsx|@/lib/photos",
  "src/components/photos/PhotoAnalysisViewer.tsx|@/lib/queries/photo-analysis",
  "src/components/photos/PhotoAnalysisViewer.tsx|@/lib/queries/projects",
  "src/components/pitch-deck/PitchDeckGenerator.tsx|@/lib/auth",
  "src/components/pitch-deck/PitchDeckGenerator.tsx|@/lib/logger",
  "src/components/pitch-deck/PitchDeckGenerator.tsx|@/lib/mappers",
  "src/components/pitch-deck/PitchDeckGenerator.tsx|@/lib/photos",
  "src/components/pitch-deck/PitchDeckGenerator.tsx|@/lib/pitchDeck",
  "src/components/pitch-deck/PitchDeckGenerator.tsx|@/lib/queries/floorplans",
  "src/components/pitch-deck/PitchDeckGenerator.tsx|@/lib/queries/photo-analysis",
  "src/components/pitch-deck/PitchDeckGenerator.tsx|@/lib/queries/pitch-decks",
  "src/components/pitch-deck/PitchDeckGenerator.tsx|@/lib/queries/projects",
  "src/components/platform/ProductCard.tsx|@/core/platform",
  "src/components/ui/accordion.tsx|@/lib/utils",
  "src/components/ui/button.tsx|@/lib/utils",
  "src/components/ui/input.tsx|@/lib/utils",
  "src/components/ui/label.tsx|@/lib/utils",
  "src/components/ui/separator.tsx|@/lib/utils",
  "src/components/ui/skeleton.tsx|@/lib/utils",
  "src/components/ui/textarea.tsx|@/lib/utils",
  "src/hooks/useAuth.ts|@/lib/auth",
  "src/hooks/useAuth.ts|@/lib/logger",
  "src/hooks/useGallery.ts|@/lib/auth",
  "src/hooks/useGallery.ts|@/lib/logger",
  "src/hooks/useGallery.ts|@/lib/queries/gallery",
  "src/hooks/useOpportunities.ts|@/core/dealCopilot",
  "src/hooks/useOpportunities.ts|@/lib/projects",
  "src/hooks/useProjects.ts|@/lib/mappers",
  "src/hooks/useProjects.ts|@/lib/projects",
  "src/hooks/useRole.ts|@/lib/role",
  "src/routes/__root.tsx|@/lib/logger",
  "src/routes/__root.tsx|@/lib/sentry",
  "src/routes/_authed.tsx|@/lib/auth",
  "src/routes/_authed/admin.tsx|@/lib/logger",
  "src/routes/_authed/dashboard.tsx|@/core/trades",
  "src/routes/_authed/dashboard.tsx|@/core/trades/tradesJob.selectors",
  "src/routes/_authed/dashboard.tsx|@/lib/utils",
  "src/routes/_authed/dashboard.tsx|@/services/trades/tradesJobInterestStore",
  "src/routes/_authed/dashboard.tsx|@/services/trades/tradesJobStore",
  "src/routes/_authed/deal-copilot/$opportunityId.edit.tsx|@/core/dealCopilot",
  "src/routes/_authed/deal-copilot/$opportunityId.tsx|@/lib/utils",
  "src/routes/_authed/deal-copilot/index.tsx|@/core/platform",
  "src/routes/_authed/marketplace.tsx|@/lib/analytics",
  "src/routes/_authed/marketplace.tsx|@/lib/queries/marketplace",
  "src/routes/_authed/projects.$id.analysis.tsx|@/core/reports",
  "src/routes/_authed/projects.$id.analysis.tsx|@/lib/analytics",
  "src/routes/_authed/projects.$id.estimate.tsx|@/core/projects",
  "src/routes/_authed/projects.$id.estimate.tsx|@/core/constants",
  "src/routes/_authed/projects.$id.estimate.tsx|@/core/pricing",
  "src/routes/_authed/projects.$id.estimate.tsx|@/lib/analytics",
  "src/routes/_authed/projects.$id.estimate.tsx|@/lib/logger",
  "src/routes/_authed/projects.$id.index.tsx|@/core/projects",
  "src/routes/_authed/projects.$id.index.tsx|@/lib/mappers",
  "src/routes/_authed/projects.$id.index.tsx|@/lib/queries/projects",
  "src/routes/_authed/projects.$id.index.tsx|@/lib/queries/floorplans",
  "src/routes/_authed/projects.$id.index.tsx|@/lib/queries/gallery",
  "src/routes/_authed/projects.$id.index.tsx|@/lib/queries/photo-analysis",
  "src/routes/_authed/projects.$id.index.tsx|@/lib/queries/pitch-decks",
  "src/routes/_authed/projects.$id.report.tsx|@/core/pricing",
  "src/routes/_authed/projects.$id.report.tsx|@/core/reports",
  "src/routes/_authed/projects.$id.report.tsx|@/lib/analytics",
  "src/routes/_authed/projects.$id.report.tsx|@/lib/logger",
  "src/routes/_authed/projects.$id.report.tsx|@/lib/sentry",
  "src/routes/_authed/projects.$id.scope.tsx|@/core/pricing",
  "src/routes/_authed/projects.$id.scope.tsx|@/lib/logger",
  "src/routes/_authed/projects.$id.scope.tsx|@/lib/sentry",
  "src/routes/_authed/projects.$id.upload.tsx|@/core/projects",
  "src/routes/_authed/projects.$id.upload.tsx|@/lib/analytics",
  "src/routes/_authed/projects.new.tsx|@/core/constants",
  "src/routes/_authed/projects.new.tsx|@/core/projects",
  "src/routes/_authed/projects.new.tsx|@/lib/analytics",
  "src/routes/_authed/settings.tsx|@/core/constants",
  "src/routes/_authed/settings.tsx|@/core/projects",
  "src/routes/_authed/settings.tsx|@/lib/logger",
  "src/routes/_authed/trades_.$jobId_.edit.tsx|@/core/trades",
  "src/routes/_authed/trades_.$jobId_.edit.tsx|@/services/trades/tradesJobStore",
  "src/routes/_authed/trades_.new.tsx|@/core/trades",
  "src/routes/_authed/trades_.new.tsx|@/lib/analytics",
  "src/routes/_authed/trades_.new.tsx|@/services/trades/tradesJobStore",
  "src/routes/_authed/trades_.profile.tsx|@/core/trades",
  "src/routes/_authed/trades_.profile.tsx|@/services/trades/tradeProfileStore",
  "src/routes/auth.tsx|@/lib/analytics",
  "src/routes/auth.tsx|@/lib/auth",
  "src/routes/auth.tsx|@/lib/logger",
  "src/routes/auth_.callback.tsx|@/lib/auth",
  "src/routes/gallery.$slug.tsx|@/lib/queries/gallery",
  "src/routes/gallery.tsx|@/lib/queries/gallery",
  "src/routes/index.tsx|@/core/reports",
  "src/routes/trades.tsx|@/core/reports",
  "src/routes/trades.tsx|@/core/trades",
  "src/routes/trades.tsx|@/core/trades/tradesJob.selectors",
  "src/routes/trades.tsx|@/services/trades/tradesJobStore",
  "src/routes/trades_.$jobId.tsx|@/core/trades",
  "src/routes/trades_.$jobId.tsx|@/core/trades/tradesJob.selectors",
  "src/routes/trades_.$jobId.tsx|@/services/trades/tradeProfileStore",
  "src/routes/trades_.$jobId.tsx|@/services/trades/tradesJobInterestStore",
  "src/routes/trades_.$jobId.tsx|@/services/trades/tradesJobStore",
  "src/serverFns/auth.ts|@/lib/auth",
  "src/serverFns/dealAnalysis.ts|@/core/dealCopilot/dealAnalysis",
  "src/serverFns/dealAnalysis.ts|@/lib/rate-limit",
  "src/serverFns/dealChat.ts|@/lib/rate-limit",
  "src/serverFns/projects.ts|@/lib/mappers",
  "src/serverFns/projects.ts|@/lib/projects",
]);

function listTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFiles(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

function collectCurrentViolations(): string[] {
  const found = new Set<string>();

  for (const targetDir of TARGET_DIRS) {
    const absDir = join(ROOT, targetDir);
    for (const file of listTsFiles(absDir)) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      const content = readFileSync(file, "utf8");
      for (const match of content.matchAll(
        new RegExp(IMPORT_PATTERN.source, IMPORT_PATTERN.flags),
      )) {
        const specifier = match[1] ?? "";
        if (!FORBIDDEN_PREFIXES.some((prefix) => specifier.startsWith(prefix))) continue;
        found.add(`${rel}|${specifier}`);
      }
    }
  }

  return Array.from(found).sort();
}

function formatViolation(entry: string): string {
  const [file, specifier] = entry.split("|");
  return `"${file}" imports forbidden "${specifier}" — migrate to ${MIGRATION_GUIDANCE}.`;
}

test("no legacy imports in routes/hooks/components/serverFns beyond approved baseline", () => {
  const observed = collectCurrentViolations();
  const newViolations = observed.filter((entry) => !BASELINE_ALLOWLIST.has(entry));
  const resolvedFromBaseline = Array.from(BASELINE_ALLOWLIST).filter(
    (entry) => !observed.includes(entry),
  );

  const message = [
    "New legacy-import violations detected:",
    ...newViolations.map(formatViolation),
    resolvedFromBaseline.length > 0 ? "\nResolved baseline entries (update allowlist):" : "",
    ...resolvedFromBaseline.map((entry) => `- ${entry}`),
  ]
    .filter(Boolean)
    .join("\n");

  assert.deepEqual(newViolations, [], message);
});
