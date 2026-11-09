/** In-memory token bucket per key (per serverless instance — a best-effort abuse guard, not a quota). */
export function createRateLimiter(opts: { capacity: number; refillPerSec: number; now?: () => number }) {
  const now = opts.now ?? Date.now;
  const buckets = new Map<string, { tokens: number; at: number }>();
  return function allow(key: string): boolean {
    const t = now();
    const b = buckets.get(key) ?? { tokens: opts.capacity, at: t };
    b.tokens = Math.min(opts.capacity, b.tokens + ((t - b.at) / 1000) * opts.refillPerSec);
    b.at = t;
    if (buckets.size > 10_000) buckets.clear();
    if (b.tokens < 1) {
      buckets.set(key, b);
      return false;
    }
    b.tokens -= 1;
    buckets.set(key, b);
    return true;
  };
}
