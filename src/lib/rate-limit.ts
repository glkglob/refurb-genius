// Minimal in-memory rate limiter for AI / expensive ops (process-local).
// For production scale, replace with Redis/Upstash/Supabase rate limits.
// Limits: e.g. 10 AI calls per user per minute.

const buckets = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10; // generous for launch; tune down if needed

export function checkRateLimit(
  key: string,
  max = MAX_PER_WINDOW,
  windowMs = WINDOW_MS,
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  // Opportunistic cleanup to prevent unbounded memory growth in long-lived processes.
  if (buckets.size > 1000) {
    for (const [k, v] of buckets) {
      if (now > v.resetAt) buckets.delete(k);
    }
  }
  let bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  if (bucket.count >= max) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count++;
  return { allowed: true };
}

export function rateLimitKeyForUser(userId: string | null | undefined, action: string): string {
  return `${userId || "anon"}:${action}`;
}
