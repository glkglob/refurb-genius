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
}

export function analyzeProviderHealth(): ProviderHealthSummary {
  const counters = getCounters();

  // Vision analysis
  const visionTotal =
    counters.vision_success +
    counters.vision_timeout +
    counters.vision_parse_failure +
    counters.vision_rate_limit +
    counters.vision_fallback_used;

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
  const redesignTotal =
    counters.redesign_success +
    counters.redesign_timeout +
    counters.redesign_parse_failure +
    counters.redesign_fallback_used;

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

  return {
    timestamp: new Date().toISOString(),
    vision: {
      ...visionStats,
      healthStatus: visionHealth,
    },
    redesign: {
      ...redesignStats,
      healthStatus: redesignHealth,
    },
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
