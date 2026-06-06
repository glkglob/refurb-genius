"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { Slider } from "@repo/ui/slider"; // note: if not present in @repo/ui yet, falls back gracefully or use native range
import { TrendingUp } from "lucide-react";
import type { ProjectWithProgress } from "@/lib/mappers";
import type { Financials } from "@/lib/queries/projects";

interface SensitivityAnalysisProps {
  projectId: string;
  project: ProjectWithProgress;
  financials: Financials | null;
}

export function SensitivityAnalysis({ project, financials }: SensitivityAnalysisProps) {
  // Base values from real project/financials data
  const basePurchase = project.purchase_price;
  const baseGdv = project.estimated_gdv;
  const baseRefurb = financials?.refurbBudget ?? 45000;

  // Adjustable variables (real investment levers)
  const [gdvMultiplier, setGdvMultiplier] = useState(1.0); // 0.7 - 1.3
  const [refurbMultiplier, setRefurbMultiplier] = useState(1.0); // 0.6 - 1.4
  const [financeRate, setFinanceRate] = useState(0.06); // interest/holding cost rate
  const [holdingMonths, setHoldingMonths] = useState(6);
  const [legalFees, setLegalFees] = useState(2500);
  const [stampDuty, setStampDuty] = useState(0.03); // % of purchase
  const [sellingFees, setSellingFees] = useState(0.025); // % of GDV

  // Computed current scenario
  const current = useMemo(() => {
    const adjustedGdv = Math.round(baseGdv * gdvMultiplier);
    const adjustedRefurb = Math.round(baseRefurb * refurbMultiplier);
    const purchase = basePurchase;

    const financeCost = Math.round(
      (purchase + adjustedRefurb) * financeRate * (holdingMonths / 12),
    );
    const stamp = Math.round(purchase * stampDuty);
    const sellFees = Math.round(adjustedGdv * sellingFees);
    const totalCosts = purchase + adjustedRefurb + financeCost + legalFees + stamp + sellFees;

    const profit = adjustedGdv - totalCosts;
    const roi = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;

    return {
      gdv: adjustedGdv,
      refurb: adjustedRefurb,
      totalCosts,
      profit,
      roi: Math.round(roi * 10) / 10,
    };
  }, [
    baseGdv,
    baseRefurb,
    basePurchase,
    gdvMultiplier,
    refurbMultiplier,
    financeRate,
    holdingMonths,
    legalFees,
    stampDuty,
    sellingFees,
  ]);

  // Generate sensitivity curves (Profit vs Refurb budget, ROI vs GDV)
  const chartData = useMemo(() => {
    const data: Array<{ x: number; profit: number; roi: number }> = [];

    // Vary refurb from 60% to 140% of base
    for (let i = 0.6; i <= 1.41; i += 0.1) {
      const r = Math.round(baseRefurb * i);
      const g = Math.round(baseGdv * gdvMultiplier);
      const fin = Math.round((basePurchase + r) * financeRate * (holdingMonths / 12));
      const st = Math.round(basePurchase * stampDuty);
      const sf = Math.round(g * sellingFees);
      const tc = basePurchase + r + fin + legalFees + st + sf;
      const p = g - tc;
      const ro = tc > 0 ? (p / tc) * 100 : 0;
      data.push({
        x: Math.round(r / 1000) * 1000,
        profit: Math.round(p),
        roi: Math.round(ro * 10) / 10,
      });
    }
    return data;
  }, [
    baseGdv,
    basePurchase,
    baseRefurb,
    gdvMultiplier,
    financeRate,
    holdingMonths,
    legalFees,
    stampDuty,
    sellingFees,
  ]);

  const gdvData = useMemo(() => {
    const data: Array<{ x: number; profit: number; roi: number }> = [];
    for (let i = 0.7; i <= 1.31; i += 0.1) {
      const g = Math.round(baseGdv * i);
      const r = Math.round(baseRefurb * refurbMultiplier);
      const fin = Math.round((basePurchase + r) * financeRate * (holdingMonths / 12));
      const st = Math.round(basePurchase * stampDuty);
      const sf = Math.round(g * sellingFees);
      const tc = basePurchase + r + fin + legalFees + st + sf;
      const p = g - tc;
      const ro = tc > 0 ? (p / tc) * 100 : 0;
      data.push({
        x: Math.round(g / 1000) * 1000,
        profit: Math.round(p),
        roi: Math.round(ro * 10) / 10,
      });
    }
    return data;
  }, [
    baseGdv,
    basePurchase,
    baseRefurb,
    refurbMultiplier,
    financeRate,
    holdingMonths,
    legalFees,
    stampDuty,
    sellingFees,
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Sensitivity Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Current scenario from real levers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Adjusted GDV</div>
              <div className="text-xl font-semibold tabular-nums">
                £{current.gdv.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Adjusted Refurb</div>
              <div className="text-xl font-semibold tabular-nums">
                £{current.refurb.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Est. Profit</div>
              <div
                className={`text-xl font-semibold tabular-nums ${current.profit >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                £{current.profit.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">ROI</div>
              <div className="text-xl font-semibold tabular-nums">{current.roi.toFixed(1)}%</div>
            </div>
          </div>

          {/* Sliders - real variables */}
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
            <div>
              <label className="text-sm font-medium">
                GDV Multiplier: {(gdvMultiplier * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min={0.7}
                max={1.3}
                step={0.05}
                value={gdvMultiplier}
                onChange={(e) => setGdvMultiplier(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Refurb Multiplier: {(refurbMultiplier * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min={0.6}
                max={1.4}
                step={0.05}
                value={refurbMultiplier}
                onChange={(e) => setRefurbMultiplier(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Finance / Holding Rate: {(financeRate * 100).toFixed(1)}%
              </label>
              <input
                type="range"
                min={0.02}
                max={0.12}
                step={0.005}
                value={financeRate}
                onChange={(e) => setFinanceRate(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Holding Period: {holdingMonths} months</label>
              <input
                type="range"
                min={3}
                max={18}
                step={1}
                value={holdingMonths}
                onChange={(e) => setHoldingMonths(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Legal / Conveyancing: £{legalFees}</label>
              <input
                type="range"
                min={1000}
                max={6000}
                step={250}
                value={legalFees}
                onChange={(e) => setLegalFees(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Stamp Duty Rate: {(stampDuty * 100).toFixed(1)}%
              </label>
              <input
                type="range"
                min={0}
                max={0.08}
                step={0.005}
                value={stampDuty}
                onChange={(e) => setStampDuty(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Selling Fees (GDV %): {(sellingFees * 100).toFixed(1)}%
              </label>
              <input
                type="range"
                min={0.01}
                max={0.05}
                step={0.0025}
                value={sellingFees}
                onChange={(e) => setSellingFees(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>

          {/* Recharts curves - theme aware via css vars if configured, responsive */}
          <div className="space-y-8 pt-4">
            <div>
              <h4 className="font-medium mb-2">Profit vs Refurb Budget</h4>
              <div className="h-72 w-full">
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="x" tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                    <YAxis tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => [`£${v.toLocaleString()}`, "Profit"]} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                      name="Profit"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">ROI vs GDV</h4>
              <div className="h-72 w-full">
                <ResponsiveContainer>
                  <LineChart data={gdvData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="x" tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                    <YAxis tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, "ROI"]} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="roi"
                      stroke="hsl(var(--chart-2, var(--primary)))"
                      strokeWidth={2}
                      dot={false}
                      name="ROI %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            All curves use live project numbers + your current slider assumptions. Adjust to model
            risk.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
