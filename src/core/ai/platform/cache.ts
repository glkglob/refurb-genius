// Lightweight AI result cache (in-memory for now).
// Keyed by project + a signature of inputs (photo count + key metadata + mode).
// Future: content-hash photos, persist to Supabase for cross-session, invalidate on photo mutation.

type CacheEntry<T> = {
  value: T;
  ts: number;
  meta?: Record<string, unknown>;
};

const mem = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 6; // 6h

function makeKey(projectId: string, sig: string, mode = "balanced"): string {
  return `${projectId}:${mode}:${sig}`;
}

export function getCached<T>(projectId: string, sig: string, mode?: string): T | undefined {
  const k = makeKey(projectId, sig, mode);
  const e = mem.get(k) as CacheEntry<T> | undefined;
  if (!e) return undefined;
  if (Date.now() - e.ts > DEFAULT_TTL_MS) {
    mem.delete(k);
    return undefined;
  }
  return e.value;
}

export function setCached<T>(
  projectId: string,
  sig: string,
  value: T,
  mode?: string,
  meta?: Record<string, unknown>,
): void {
  const k = makeKey(projectId, sig, mode);
  mem.set(k, { value, ts: Date.now(), meta });
}

export function clearProjectCache(projectId: string): void {
  for (const k of mem.keys()) {
    if (k.startsWith(`${projectId}:`)) mem.delete(k);
  }
}

export function getCacheStats() {
  return {
    size: mem.size,
    keys: Array.from(mem.keys()).slice(0, 20),
  };
}
