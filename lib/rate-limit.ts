/**
 * Sliding-window rate limiter kept in process memory.
 *
 * Good enough for a single server or a warm serverless instance. For
 * multi-region production traffic swap the Map for Upstash Redis / Vercel KV
 * with the same interface.
 */

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now, windowMs);

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}

/** Drop stale buckets every so often so the Map can't grow forever. */
function sweep(now: number, windowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.hits.every((t) => now - t >= windowMs)) buckets.delete(key);
  }
}

/**
 * Remembers recently subscribed emails so a double click or a page refresh
 * doesn't hit the ESP (or resend the guide) twice.
 */
const recentEmails = new Map<string, number>();

export function wasRecentlySubscribed(email: string, windowMs: number): boolean {
  const at = recentEmails.get(email);
  if (at && Date.now() - at < windowMs) return true;
  if (at) recentEmails.delete(email);
  return false;
}

export function markSubscribed(email: string) {
  recentEmails.set(email, Date.now());
  if (recentEmails.size > 5_000) {
    const oldestKey = recentEmails.keys().next().value;
    if (oldestKey) recentEmails.delete(oldestKey);
  }
}
