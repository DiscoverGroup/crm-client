/**
 * MongoDB-backed Rate Limiter for Netlify Functions
 *
 * Because Netlify Functions are stateless (each invocation can run on a
 * different instance), in-memory counters are ineffective.  This module
 * stores counters in a MongoDB collection with a TTL index so documents
 * expire automatically.
 *
 * Usage:
 *   const result = await checkRateLimit(db, ip, 'login', 10, 900);
 *   if (result.limited) return tooManyRequestsResponse(headers);
 */

import type { Db } from 'mongodb';

export interface RateLimitResult {
  limited: boolean;
  count: number;
  remaining: number;
  resetAfterSeconds: number;
}

const COLLECTION = 'rate_limits';

/**
 * Checks (and increments) the rate limit counter for a given key.
 *
 * @param db            Mongo Db instance (already connected)
 * @param ip            Client IP address (from event.headers['x-forwarded-for'] etc.)
 * @param endpoint      Short label, e.g. 'login', 'register', 'verify-otp'
 * @param maxRequests   Maximum allowed requests in the window (default 10)
 * @param windowSeconds Length of the sliding window in seconds (default 900 = 15 min)
 */
export async function checkRateLimit(
  db: Db,
  ip: string,
  endpoint: string,
  maxRequests = 10,
  windowSeconds = 900
): Promise<RateLimitResult> {
  const col = db.collection(COLLECTION);
  const key = `${ip}:${endpoint}`;
  const now = new Date();

  // Ensure TTL index exists (no-op if already created)
  try {
    await col.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: windowSeconds, background: true }
    );
  } catch {
    // Index may already exist with a different TTL — that's fine
  }

  // Atomically increment (or create) the counter
  const result = await col.findOneAndUpdate(
    { key },
    {
      $inc: { count: 1 },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, returnDocument: 'after' }
  );

  const count = result?.count ?? 1;
  const limited = count > maxRequests;

  return {
    limited,
    count,
    remaining: Math.max(0, maxRequests - count),
    resetAfterSeconds: windowSeconds,
  };
}

/**
 * Builds rate-limit response headers for inclusion in API responses.
 * These follow the standard RateLimit headers (draft RFC).
 */
export function getRateLimitHeaders(
  result: RateLimitResult,
  maxRequests: number
): Record<string, string> {
  return {
    'RateLimit-Limit': String(maxRequests),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(result.resetAfterSeconds),
    ...(result.limited ? { 'Retry-After': String(result.resetAfterSeconds) } : {}),
  };
}

/**
 * Convenience: returns a 429 Too Many Requests response.
 */
export function tooManyRequestsResponse(
  headers: Record<string, string>,
  retryAfterSeconds = 900
) {
  return {
    statusCode: 429,
    headers: {
      ...headers,
      'Retry-After': String(retryAfterSeconds),
    },
    body: JSON.stringify({
      success: false,
      error: 'Too many requests. Please try again later.',
    }),
  };
}

/**
 * Extracts the real client IP from a Netlify Function event.
 * Netlify puts the real IP in 'x-nf-client-connection-ip'; falls back to
 * 'x-forwarded-for' and then 'client-ip'.
 */
export function getClientIP(headers: Record<string, string | undefined>): string {
  return (
    headers['x-nf-client-connection-ip'] ||
    (headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    headers['client-ip'] ||
    'unknown'
  );
}
