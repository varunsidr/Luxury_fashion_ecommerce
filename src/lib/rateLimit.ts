import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const buckets = new Map<string, { count: number; resetAt: number }>();
let callsSinceCleanup = 0;

function localRateLimit(key: string, limit: number, windowMs: number): boolean {
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

/** Returns null when the shared production limiter is unavailable. */
export async function isRateLimited(key: string, limit: number, windowMs: number): Promise<boolean | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const salt = process.env.RATE_LIMIT_SECRET;
  if (!url || !serviceKey || !salt || salt.length < 32) {
    return process.env.NODE_ENV === "production" ? null : localRateLimit(key, limit, windowMs);
  }
  try {
    const client = createClient(url, serviceKey, { auth: { persistSession: false } });
    const keyHash = createHmac("sha256", salt).update(key).digest("hex");
    const { data, error } = await client.rpc("consume_api_rate_limit", {
      p_key_hash: keyHash,
      p_limit: limit,
      p_window_seconds: Math.ceil(windowMs / 1000),
    });
    return error || typeof data !== "boolean" ? null : data;
  } catch {
    return null;
  }
}

export function getClientAddress(request: Request): string {
  // The rightmost address is the one appended by the closest trusted proxy.
  // Production must configure its proxy to overwrite or append this header.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean);
  return forwarded?.at(-1) || "unknown";
}
