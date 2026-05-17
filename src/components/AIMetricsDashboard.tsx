import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/MetricCard";
import { Activity, AlertTriangle, CheckCircle, Zap } from "lucide-react";
import { getCounters } from "@/lib/provider-diagnostics";
import { analyzeProviderHealth, getFailureRecommendations } from "@/lib/provider-health-analysis";
import type { ProviderHealthSummary } from "@/lib/provider-health-analysis";

export function AIMetricsDashboard() {
  const [health, setHealth] = useState<ProviderHealthSummary | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  useEffect(() => {
    const updateMetrics = () => {
      const healthData = analyzeProviderHealth();
      setHealth(healthData);
      setRecommendations(getFailureRecommendations(healthData));
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 30000); // Refresh every 30s

    return () => clearInterval(interval);
  }, []);

  if (!health) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Provider Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Loading metrics...</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-600";
      case "degraded":
        return "text-yellow-600";
      case "critical":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-5 h-5" />;
      case "degraded":
        return <AlertTriangle className="w-5 h-5" />;
      case "critical":
        return <AlertTriangle className="w-5 h-5" />;
      default:
        return <Activity className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            AI Provider Metrics
          </CardTitle>
          <p className="text-xs text-gray-500 mt-2">
            Last updated: {new Date(health.timestamp).toLocaleTimeString()}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Vision Metrics */}
            <div className="border-b pb-6">
              <div
                className={`flex items-center gap-2 mb-4 ${getStatusColor(health.vision.healthStatus)}`}
              >
                {getStatusIcon(health.vision.healthStatus)}
                <h3 className="font-semibold">Vision Analysis</h3>
                <span className="text-xs uppercase ml-auto font-bold">
                  {health.vision.healthStatus}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  label="Success Rate"
                  value={`${health.vision.successRate.toFixed(1)}%`}
                  icon={CheckCircle}
                  hint="Successful analyses"
                />
                <MetricCard
                  label="Timeout Rate"
                  value={`${health.vision.timeoutRate.toFixed(1)}%`}
                  icon={AlertTriangle}
                  hint="Requests exceeding 60s"
                />
                <MetricCard
                  label="Parse Failures"
                  value={`${health.vision.parseFailureRate.toFixed(1)}%`}
                  icon={AlertTriangle}
                  hint="JSON parsing errors"
                />
                <MetricCard
                  label="Fallback Usage"
                  value={`${health.vision.fallbackRate.toFixed(1)}%`}
                  icon={Activity}
                  hint="Using mock provider"
                />
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Total operations: {health.vision.totalOperations}
              </p>
            </div>

            {/* Redesign Metrics */}
            <div>
              <div
                className={`flex items-center gap-2 mb-4 ${getStatusColor(health.redesign.healthStatus)}`}
              >
                {getStatusIcon(health.redesign.healthStatus)}
                <h3 className="font-semibold">Redesign Generation</h3>
                <span className="text-xs uppercase ml-auto font-bold">
                  {health.redesign.healthStatus}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  label="Success Rate"
                  value={`${health.redesign.successRate.toFixed(1)}%`}
                  icon={CheckCircle}
                  hint="Successful generations"
                />
                <MetricCard
                  label="Timeout Rate"
                  value={`${health.redesign.timeoutRate.toFixed(1)}%`}
                  icon={AlertTriangle}
                  hint="Requests exceeding 30s"
                />
                <MetricCard
                  label="Parse Failures"
                  value={`${health.redesign.parseFailureRate.toFixed(1)}%`}
                  icon={AlertTriangle}
                  hint="JSON parsing errors"
                />
                <MetricCard
                  label="Fallback Usage"
                  value={`${health.redesign.fallbackRate.toFixed(1)}%`}
                  icon={Activity}
                  hint="Using static concepts"
                />
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Total operations: {health.redesign.totalOperations}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card
          className={
            recommendations.some((r) => r.includes("Critical"))
              ? "border-red-200"
              : "border-yellow-200"
          }
        >
          <CardHeader>
            <CardTitle className="text-sm">Operational Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm flex gap-2">
                  <span className="text-gray-400">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
