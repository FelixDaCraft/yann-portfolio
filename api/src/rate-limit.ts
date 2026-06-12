// Rate-limit fixed-window en mémoire — mono-instance, reset au redéploiement (acceptable).
// Porté de sky-sitter lib/rate-limit.ts.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Sweep périodique pour éviter la croissance infinie de la Map.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}, 10 * 60 * 1000).unref();

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  existing.count += 1;
  if (existing.count > opts.limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfterSec: 0 };
}
