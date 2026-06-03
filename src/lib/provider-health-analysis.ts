// Provider failure analysis and diagnostics.
// Categorizes and summarizes AI provider failures for operational visibility.
// NO external analytics platforms — lightweight structured summaries only.

import { getCounters } from "@/lib/provider-diagnostics";
import type { ProviderDiagnostics } from "@/lib/provider-diagnostics";

export interface ProviderHealthSummary {
  timestamp: string;
  vision: {
    successRate: number; // 0-100%
    timeoutRate: number;
    parseFailureRate: number;
    fallbackRate: number;
    totalOperations: number;
    healthStatus: "healthy" | "degraded" | "critical";
  };
  redesign: {
    successRate: number;
    timeoutRate: number;
    parseFailureRate: number;
    fallbackRate: number;
    totalOperations: number;
    healthStatus: "healthy" | "degraded" | "critical";
  };
  // Phase 2 strengthening: include estimate/scope for full observability of primary AI paths
  estimate: {
    successRate: number;
    timeoutRate: number;
    parseFailureRate: number;
    fallbackRate: number;
    totalOperations: number;
    healthStatus: "healthy" | "degraded" | "critical";
  };
  scope: {
    successRate: number;
    timeoutRate: number;
    parseFailureRate: number;
    fallbackRate: number;
    totalOperations: number;
    healthStatus: "healthy" | "degraded" | "critical";
  };
}

export function analyzeProviderHealth(): ProviderHealthSummary {
  const counters = getCounters();

  // Vision analysis
  // Note: vision_fallback_used is NOT added to visionTotal because it's incremented
  // alongside failure counters (timeout, rate_limit, parse_failure), not as a separate operation.
  const visionTotal =
    counters.vision_success +
    counters.vision_timeout +
    counters.vision_parse_failure +
    counters.vision_rate_limit;

  const visionStats =
    visionTotal > 0
      ? {
          successRate: (counters.vision_success / visionTotal) * 100,
          timeoutRate: (counters.vision_timeout / visionTotal) * 100,
          parseFailureRate: (counters.vision_parse_failure / visionTotal) * 100,
          fallbackRate: (counters.vision_fallback_used / visionTotal) * 100,
          totalOperations: visionTotal,
        }
      : {
          successRate: 0,
          timeoutRate: 0,
          parseFailureRate: 0,
          fallbackRate: 0,
          totalOperations: 0,
        };

  // Determine vision health status
  let visionHealth: "healthy" | "degraded" | "critical" = "healthy";
  if (visionStats.timeoutRate > 15 || visionStats.fallbackRate > 20) {
    visionHealth = "critical";
  } else if (visionStats.timeoutRate > 10 || visionStats.fallbackRate > 15) {
    visionHealth = "degraded";
  }

  // Redesign analysis
  // Note: redesign_fallback_used is NOT added to redesignTotal because it's incremented
  // alongside failure counters (timeout, parse_failure), not as a separate operation.
  const redesignTotal =
    counters.redesign_success + counters.redesign_timeout + counters.redesign_parse_failure;

  const redesignStats =
    redesignTotal > 0
      ? {
          successRate: (counters.redesign_success / redesignTotal) * 100,
          timeoutRate: (counters.redesign_timeout / redesignTotal) * 100,
          parseFailureRate: (counters.redesign_parse_failure / redesignTotal) * 100,
          fallbackRate: (counters.redesign_fallback_used / redesignTotal) * 100,
          totalOperations: redesignTotal,
        }
      : {
          successRate: 0,
          timeoutRate: 0,
          parseFailureRate: 0,
          fallbackRate: 0,
          totalOperations: 0,
        };

  // Determine redesign health status
  let redesignHealth: "healthy" | "degraded" | "critical" = "healthy";
  if (redesignStats.timeoutRate > 20 || redesignStats.fallbackRate > 25) {
    redesignHealth = "critical";
  } else if (redesignStats.timeoutRate > 15 || redesignStats.fallbackRate > 20) {
    redesignHealth = "degraded";
  }

  // Estimate (Phase 2: full coverage)
  const estimateTotal =
    counters.estimate_ai_success +
    counters.estimate_timeout +
    counters.estimate_parse_failure +
    counters.estimate_rate_limit;
  const estimateStats =
    estimateTotal > 0
      ? {
          successRate: (counters.estimate_ai_success / estimateTotal) * 100,
          timeoutRate: (counters.estimate_timeout / estimateTotal) * 100,
          parseFailureRate: (counters.estimate_parse_failure / estimateTotal) * 100,
          fallbackRate: (counters.estimate_fallback_used / estimateTotal) * 100,
          totalOperations: estimateTotal,
        }
      : {
          successRate: 0,
          timeoutRate: 0,
          parseFailureRate: 0,
          fallbackRate: 0,
          totalOperations: 0,
        };
  let estimateHealth: "healthy" | "degraded" | "critical" = "healthy";
  if (estimateStats.timeoutRate > 10 || estimateStats.fallbackRate > 15)
    estimateHealth = "critical";
  else if (estimateStats.timeoutRate > 5 || estimateStats.fallbackRate > 10)
    estimateHealth = "degraded";

  // Scope
  const scopeTotal =
    counters.scope_ai_success +
    counters.scope_timeout +
    counters.scope_parse_failure +
    counters.scope_rate_limit;
  const scopeStats =
    scopeTotal > 0
      ? {
          successRate: (counters.scope_ai_success / scopeTotal) * 100,
          timeoutRate: (counters.scope_timeout / scopeTotal) * 100,
          parseFailureRate: (counters.scope_parse_failure / scopeTotal) * 100,
          fallbackRate: (counters.scope_fallback_used / scopeTotal) * 100,
          totalOperations: scopeTotal,
        }
      : {
          successRate: 0,
          timeoutRate: 0,
          parseFailureRate: 0,
          fallbackRate: 0,
          totalOperations: 0,
        };
  let scopeHealth: "healthy" | "degraded" | "critical" = "healthy";
  if (scopeStats.timeoutRate > 15 || scopeStats.fallbackRate > 20) scopeHealth = "critical";
  else if (scopeStats.timeoutRate > 10 || scopeStats.fallbackRate > 15) scopeHealth = "degraded";

  return {
    timestamp: new Date().toISOString(),
    vision: { ...visionStats, healthStatus: visionHealth },
    redesign: { ...redesignStats, healthStatus: redesignHealth },
    estimate: { ...estimateStats, healthStatus: estimateHealth },
    scope: { ...scopeStats, healthStatus: scopeHealth },
  };
}

export function getFailureRecommendations(health: ProviderHealthSummary): string[] {
  const recommendations: string[] = [];

  // Vision recommendations
  if (health.vision.healthStatus === "critical") {
    if (health.vision.timeoutRate > 15) {
      recommendations.push(
        "Vision: High timeout rate (>15%). Check OpenAI API status or network latency.",
      );
    }
    if (health.vision.fallbackRate > 20) {
      recommendations.push(
        "Vision: High fallback rate (>20%). Review parser for JSON drift or invalid enum values.",
      );
    }
  } else if (health.vision.healthStatus === "degraded") {
    if (health.vision.timeoutRate > 10) {
      recommendations.push("Vision: Timeout rate elevated (>10%). Monitor API latency.");
    }
  }

  // Redesign recommendations
  if (health.redesign.healthStatus === "critical") {
    if (health.redesign.timeoutRate > 20) {
      recommendations.push(
        "Redesign: High timeout rate (>20%). Consider reducing batch size or increasing timeout.",
      );
    }
    if (health.redesign.fallbackRate > 25) {
      recommendations.push(
        "Redesign: High fallback rate (>25%). Review palette/tagline validation logic.",
      );
    }
  } else if (health.redesign.healthStatus === "degraded") {
    if (health.redesign.timeoutRate > 15) {
      recommendations.push("Redesign: Timeout rate elevated (>15%). Monitor generation latency.");
    }
  }

  // Estimate / Scope (Phase 2)
  if (health.estimate.healthStatus === "critical" && health.estimate.fallbackRate > 15) {
    recommendations.push(
      "Estimate: High fallback rate — review prompt for realistic costs or normalize more aggressively.",
    );
  }
  if (health.scope.healthStatus === "critical" && health.scope.timeoutRate > 15) {
    recommendations.push(
      "Scope: High timeout on multi-photo analysis — consider fewer photos per call.",
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("All providers operating within acceptable thresholds.");
  }

  return recommendations;
}

export function formatHealthReport(health: ProviderHealthSummary): string {
  const lines: string[] = [];

  lines.push(`\n📊 AI Provider Health Report (${new Date(health.timestamp).toLocaleString()})`);
  lines.push("─".repeat(60));

  // Vision
  lines.push("\n🖼️ Vision Analysis:");
  lines.push(`   Success Rate: ${health.vision.successRate.toFixed(1)}%`);
  lines.push(`   Timeout Rate: ${health.vision.timeoutRate.toFixed(1)}%`);
  lines.push(`   Parse Failures: ${health.vision.parseFailureRate.toFixed(1)}%`);
  lines.push(`   Fallback Usage: ${health.vision.fallbackRate.toFixed(1)}%`);
  lines.push(`   Total Operations: ${health.vision.totalOperations}`);
  lines.push(
    `   Status: ${getHealthIcon(health.vision.healthStatus)} ${health.vision.healthStatus.toUpperCase()}`,
  );

  // Redesign
  lines.push("\n🎨 Redesign Generation:");
  lines.push(`   Success Rate: ${health.redesign.successRate.toFixed(1)}%`);
  lines.push(`   Timeout Rate: ${health.redesign.timeoutRate.toFixed(1)}%`);
  lines.push(`   Parse Failures: ${health.redesign.parseFailureRate.toFixed(1)}%`);
  lines.push(`   Fallback Usage: ${health.redesign.fallbackRate.toFixed(1)}%`);
  lines.push(`   Total Operations: ${health.redesign.totalOperations}`);
  lines.push(
    `   Status: ${getHealthIcon(health.redesign.healthStatus)} ${health.redesign.healthStatus.toUpperCase()}`,
  );

  // Recommendations
  const recommendations = getFailureRecommendations(health);
  lines.push("\n📋 Recommendations:");
  recommendations.forEach((rec) => {
    lines.push(`   • ${rec}`);
  });

  lines.push("");
  return lines.join("\n");
}

function getHealthIcon(status: string): string {
  switch (status) {
    case "healthy":
      return "✅";
    case "degraded":
      return "⚠️";
    case "critical":
      return "🚨";
    default:
      return "❓";
  }
}
