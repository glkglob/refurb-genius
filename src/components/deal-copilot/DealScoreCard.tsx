import { AlertCircle, CheckCircle2, Zap } from "lucide-react";
import type { DealScoreResult } from "@repo/services";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRecommendation } from "@/lib/deal-copilot/dealFormatting";

export interface DealScoreCardProps {
  score: DealScoreResult;
  showMissingFields?: boolean;
}

export function DealScoreCard({ score, showMissingFields = true }: DealScoreCardProps) {
  const { label, color } = formatRecommendation(score.recommendation);
  const colorClasses = {
    success: "bg-green-50 text-green-900 border-green-200",
    warning: "bg-yellow-50 text-yellow-900 border-yellow-200",
    info: "bg-blue-50 text-blue-900 border-blue-200",
    error: "bg-red-50 text-red-900 border-red-200",
  };

  const iconClasses = {
    success: "text-green-600",
    warning: "text-yellow-600",
    info: "text-blue-600",
    error: "text-red-600",
  };

  const icons = {
    success: CheckCircle2,
    warning: AlertCircle,
    info: Zap,
    error: AlertCircle,
  };

  const Icon = icons[color];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Deal Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recommendation */}
        <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
          <div className="flex items-start gap-3">
            <Icon className={`h-5 w-5 flex-shrink-0 ${iconClasses[color]}`} />
            <div>
              <p className="font-semibold">{label}</p>
              <p className="text-sm opacity-90">
                {score.recommendation === "Incomplete"
                  ? "Complete all required fields to analyze this deal"
                  : `Investment recommendation: ${label}`}
              </p>
            </div>
          </div>
        </div>

        {/* Missing fields indicator */}
        {showMissingFields && score.missingFields.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Missing required fields:</p>
            <ul className="space-y-1">
              {score.missingFields.map((field) => (
                <li key={field} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-xs">•</span>
                  {field}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Progress indicator */}
        {showMissingFields && score.missingFields.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Required fields</p>
              <p className="text-xs font-medium text-foreground">
                {7 - score.missingFields.length}/{7}
              </p>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all"
                style={{ width: `${((7 - score.missingFields.length) / 7) * 100}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
