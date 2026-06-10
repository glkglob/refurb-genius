/**
 * AI-design slice — Domain rules.
 *
 * Pure judgements over scope/redesign types. Cost normalization stays in
 * `src/core/ai/normalizers.ts` (pricing authority bridge).
 */
import type { ScopeAnalysisResult, ScopeIssue, ScopeRoom } from "./types";

export function hasCriticalIssues(scope: ScopeAnalysisResult): boolean {
  return scope.rooms.some((room) => room.issues.some((issue) => issue.severity === "critical"));
}

export function countIssuesBySeverity(
  scope: ScopeAnalysisResult,
  severity: ScopeIssue["severity"],
): number {
  return scope.rooms.reduce(
    (count, room) => count + room.issues.filter((i) => i.severity === severity).length,
    0,
  );
}

export function isActionableScope(scope: ScopeAnalysisResult): boolean {
  return (
    scope.rooms.length > 0 &&
    scope.rooms.some((room) => room.recommended_items.length > 0 || room.issues.length > 0)
  );
}

export function scopeItemCount(scope: ScopeAnalysisResult): number {
  return scope.rooms.reduce((sum, room) => sum + room.recommended_items.length, 0);
}

export function highestSeverityRoom(scope: ScopeAnalysisResult): ScopeRoom | undefined {
  const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  return [...scope.rooms].sort((a, b) => {
    const aMin = Math.min(...a.issues.map((i) => order[i.severity]), 4);
    const bMin = Math.min(...b.issues.map((i) => order[i.severity]), 4);
    return aMin - bMin;
  })[0];
}
