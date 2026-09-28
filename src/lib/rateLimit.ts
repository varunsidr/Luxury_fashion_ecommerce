const buckets = new Map<string, { count: number; resetAt: number }>();
let callsSinceCleanup = 0;

/** Process-local safeguard. Use a shared store such as Redis for multi-instance deployments. */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (++callsSinceCleanup >= 100) {
    callsSinceCleanup = 0;
    for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}

export function getClientAddress(request: Request): string {
  return request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
