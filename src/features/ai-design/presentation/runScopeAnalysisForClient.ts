/**
 * Platform-aware scope analysis dispatch.
 *
 * Web: cookie-authenticated runScopeAnalysisServerFn (dynamic import).
 * Native: Bearer POST /api/mobile/v1/scope/analyze (never the cookie serverFn).
 */
import { Capacitor } from "@capacitor/core";
import {
  assertScopeAnalysisResult,
  type ScopeAnalysisInput,
  type ScopeAnalysisResult,
} from "../domain";

export async function runScopeAnalysisForClient(
  input: ScopeAnalysisInput,
): Promise<ScopeAnalysisResult> {
  if (Capacitor.isNativePlatform()) {
    const { runScopeAnalysisNative } = await import("@/platform/http/mobile-scope-analyze");
    return assertScopeAnalysisResult(await runScopeAnalysisNative(input));
  }

  const { runScopeAnalysisServerFn } = await import("./serverFns");
  return assertScopeAnalysisResult(await runScopeAnalysisServerFn({ data: input }));
}
