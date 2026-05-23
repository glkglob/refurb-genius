/**
 * Lightweight operational counters for AI providers.
 * No telemetry vendor — structured logs only.
 */

export interface ProviderDiagnostics {
  vision_success: number;
  vision_timeout: number;
  vision_parse_failure: number;
  vision_rate_limit: number;
  vision_fallback_used: number;

  redesign_success: number;
  redesign_timeout: number;
  redesign_parse_failure: number;
  redesign_fallback_used: number;

  estimate_ai_success: number;
  estimate_timeout: number;
  estimate_parse_failure: number;
  estimate_rate_limit: number;
  estimate_fallback_used: number;

  scope_ai_success: number;
  scope_timeout: number;
  scope_parse_failure: number;
  scope_rate_limit: number;
  scope_fallback_used: number;
}

const counters: ProviderDiagnostics = {
  vision_success: 0,
  vision_timeout: 0,
  vision_parse_failure: 0,
  vision_rate_limit: 0,
  vision_fallback_used: 0,

  redesign_success: 0,
  redesign_timeout: 0,
  redesign_parse_failure: 0,
  redesign_fallback_used: 0,

  estimate_ai_success: 0,
  estimate_timeout: 0,
  estimate_parse_failure: 0,
  estimate_rate_limit: 0,
  estimate_fallback_used: 0,

  scope_ai_success: 0,
  scope_timeout: 0,
  scope_parse_failure: 0,
  scope_rate_limit: 0,
  scope_fallback_used: 0,
};

export function incrementCounter(counter: keyof ProviderDiagnostics): void {
  counters[counter]++;
}

export function getCounters(): Readonly<ProviderDiagnostics> {
  return { ...counters };
}

export function logCounterSnapshot(label: string): void {
  console.debug(`[provider-diagnostics] ${label}:`, getCounters());
}

export function resetCounters(): void {
  Object.keys(counters).forEach((k) => {
    counters[k as keyof ProviderDiagnostics] = 0;
  });
}
