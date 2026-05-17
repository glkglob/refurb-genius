import { AlertTriangle, Info } from "lucide-react";
import type { RoiEngineResult } from "@repo/services";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRiskLevel, formatCurrency, formatPercent } from "@/lib/deal-copilot/dealFormatting";

export interface DealRiskFlagsProps {
  roi: RoiEngineResult | null | undefined;
}

interface RiskFlag {
  level: "warning" | "critical";
  message: string;
}

function identifyRiskFlags(roi: RoiEngineResult): RiskFlag[] {
  const flags: RiskFlag[] = [];

  // High project cost
  if (roi.total_project_cost > 500000) {
    flags.push({
      level: "warning",
      message: `Large project cost (${formatCurrency(roi.total_project_cost)}) — ensure financing is secured`,
    });
  }

  // Low ROI
  if (roi.roi < 5) {
    flags.push({
      level: "critical",
      message: `Low ROI (${formatPercent(roi.roi)}) — deal may not meet investment targets`,
    });
  }

  // Low yield
  if (roi.gross_yield < 4) {
    flags.push({
      level: "warning",
      message: `Low rental yield (${formatPercent(roi.gross_yield)}) — limited rental income`,
    });
  }

  // Negative profit
  if (roi.estimated_profit < 0) {
    flags.push({
      level: "critical",
      message: `Negative profit (${formatCurrency(roi.estimated_profit)}) — deal will lose money`,
    });
  }

  // High risk level
  if (roi.risk_level === "High") {
    flags.push({
      level: "critical",
      message: "High execution risk — property condition and delivery challenges likely",
    });
  }

  return flags;
}

export function DealRiskFlags({ roi }: DealRiskFlagsProps) {
  if (!roi) {
    return null;
  }

  const flags = identifyRiskFlags(roi);
  const { label, color, icon } = formatRiskLevel(roi.risk_level);

  const colorClasses = {
    success: "bg-green-50 border-green-200",
    warning: "bg-yellow-50 border-yellow-200",
    error: "bg-red-50 border-red-200",
  };

  const labelClasses = {
    success: "text-green-900",
    warning: "text-yellow-900",
    error: "text-red-900",
  };

  const flagClasses = {
    warning: "bg-yellow-50 text-yellow-900 border-yellow-200",
    critical: "bg-red-50 text-red-900 border-red-200",
  };

  if (flags.length === 0) {
    return null;
  }

  return (
    <Card className={`border-2 ${colorClasses[color]}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg">Risk Assessment</CardTitle>
          <div className={`rounded-lg px-3 py-1 text-sm font-medium ${labelClasses[color]}`}>
            {label}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {flags.map((flag, index) => (
            <div
              key={index}
              className={`flex gap-3 rounded-lg border p-3 ${flagClasses[flag.level]}`}
            >
              {flag.level === "critical" ? (
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              ) : (
                <Info className="h-5 w-5 flex-shrink-0" />
              )}
              <p className="text-sm">{flag.message}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
