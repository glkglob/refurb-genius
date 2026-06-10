// Real-world data audit for AI provider quality.
// Identifies hallucinations, misclassifications, and other issues in production data.
// Note: ai_quality_feedback table is optional for controlled-beta phase.

import { supabase } from "@/platform/supabase/browser";
import { logger } from "@/lib/logger";

export interface AuditFinding {
  type:
    | "hallucination"
    | "misclassification"
    | "low_confidence"
    | "weak_palette"
    | "generic_description"
    | "invalid_gradient";
  severity: "info" | "warning" | "critical";
  projectId: string;
  photoId?: string;
  description: string;
  suggestion: string;
}

export async function auditVisionOutputs(): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];

  try {
    const { data: projects, error: projError } = await supabase
      .from("projects")
      .select("id")
      .limit(50)
      .order("created_at", { ascending: false });

    if (projError || !projects) {
      logger.error("[Audit] Failed to fetch projects", { error: String(projError) });
      return findings;
    }

    for (const project of projects) {
      try {
        const { data: photos, error: photoError } = await supabase
          .from("photos")
          .select("id, project_id, name")
          .eq("project_id", project.id)
          .limit(10);

        if (photoError || !photos) continue;

        photos.forEach((photo: Record<string, unknown>) => {
          const photoName = photo.name as string | undefined;
          if (photoName && photoName.length < 3) {
            findings.push({
              type: "misclassification",
              severity: "info",
              projectId: project.id,
              photoId: photo.id as string | undefined,
              description: `Photo has suspiciously short name: "${photoName}"`,
              suggestion: "Verify photo is not a test/placeholder image",
            });
          }

          const genericPatterns = /^(test|sample|image|photo|unnamed|untitled)/i;
          if (photoName && genericPatterns.test(photoName)) {
            findings.push({
              type: "hallucination",
              severity: "info",
              projectId: project.id,
              photoId: photo.id as string | undefined,
              description: `Photo appears to be generic/test: "${photoName}"`,
              suggestion: "Verify photo represents actual property condition",
            });
          }
        });
      } catch (err) {
        logger.warn("[Audit] Error auditing project", {
          projectId: project.id,
          error: String(err),
        });
      }
    }
  } catch (err) {
    logger.error("[Audit] Vision audit failed", { error: String(err) });
  }

  return findings;
}

export async function auditRedesignOutputs(): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];

  // Controlled-beta stub: ai_quality_feedback table not in typed schema
  logger.info(
    "[Audit] Redesign audit unavailable in controlled-beta (ai_quality_feedback table unavailable)",
  );

  return findings;
}

export async function runFullAudit(): Promise<{
  visionFindings: AuditFinding[];
  redesignFindings: AuditFinding[];
  timestamp: string;
}> {
  logger.info("[Audit] Starting full AI quality audit");

  const [visionFindings, redesignFindings] = await Promise.all([
    auditVisionOutputs(),
    auditRedesignOutputs(),
  ]);

  const report = {
    visionFindings,
    redesignFindings,
    timestamp: new Date().toISOString(),
  };

  logger.info("[Audit] Audit complete", {
    visionIssues: visionFindings.length,
    redesignIssues: redesignFindings.length,
  });

  return report;
}

export function formatAuditReport(findings: AuditFinding[]): string {
  if (findings.length === 0) {
    return "✅ No issues detected in audit";
  }

  const lines: string[] = [];
  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const warningCount = findings.filter((f) => f.severity === "warning").length;
  const infoCount = findings.filter((f) => f.severity === "info").length;

  lines.push(`\n📋 AI Quality Audit Report`);
  lines.push(`   Critical: ${criticalCount} | Warnings: ${warningCount} | Info: ${infoCount}`);
  lines.push("");

  findings.forEach((finding) => {
    const icon =
      finding.severity === "critical" ? "🚨" : finding.severity === "warning" ? "⚠️" : "ℹ️";
    lines.push(`${icon} [${finding.type}] ${finding.description}`);
    lines.push(`   → ${finding.suggestion}`);
  });

  return lines.join("\n");
}
