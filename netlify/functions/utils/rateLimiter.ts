/**
 * MongoDB-backed Rate Limiter for Netlify Functions
 *
 * Uses a fixed TTL index on `expiresAt` (expireAfterSeconds: 0) so that each
 * document carries its own absolute expiry timestamp. This avoids the
 * "conflicting TTL value" problem where multiple endpoints with different
 * window lengths all try to create the same index with different
 * expireAfterSeconds values — MongoDB only honours the first one, causing
 * rate-limit documents for shorter windows to never expire and counts to
 * grow forever, permanently blocking users.
 *
 * Usage:
 *   const result = await checkRateLimit(db, ip, 'login', 10, 900);
 *   if (result.limited) return tooManyRequestsResponse(headers);
 */

import type { Db } from 'mongodb';
import { logWarn } from './logger';

export interface RateLimitResult {
  limited: boolean;
  count: number;
  remaining: number;
  resetAfterSeconds: number;
}

const COLLECTION = 'rate_limits';

/**
 * Shared internal implementation — keys on an arbitrary string key.
 * Documents expire via a sparse TTL index on `expiresAt` (expireAfterSeconds: 0).
 * On first insert, expiresAt is set to now + windowSeconds. Subsequent increments
 * within the window do NOT change expiresAt, so the window is fixed (not sliding).
 */
async function _checkLimit(
  db: Db,
  key: string,
  endpoint: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const col = db.collection(COLLECTION);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowSeconds * 1000);

  // Single TTL index: documents auto-delete when their expiresAt is reached.
  // expireAfterSeconds: 0 means "delete as soon as expiresAt <= now".
  // This is safe to call every request — MongoDB createIndex is idempotent.
  try {
    await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });
  } catch { /* already exists — fine */ }

  // Atomically increment counter; only set expiresAt on first insert so the
  // window is fixed from the first request in the period.
  const result = await col.findOneAndUpdate(
    { key },
    {
      $inc: { count: 1 },
      $setOnInsert: { createdAt: now, expiresAt },
    },
    { upsert: true, returnDocument: 'after' }
  );

  const count = result?.count ?? 1;
  const limited = count > maxRequests;

  if (limited) {
    logWarn({
      fn: 'rateLimiter',
      msg: 'Rate limit exceeded',
      op: endpoint,
      key,
      count,
      maxRequests,
      windowSeconds,
    });
  }

  return {
    limited,
    count,
    remaining: Math.max(0, maxRequests - count),
    resetAfterSeconds: windowSeconds,
  };
}

/**
 * IP-based rate limit check.
 *
 * @param db            Mongo Db instance (already connected)
 * @param ip            Client IP address
 * @param endpoint      Short label, e.g. 'login', 'register'
 * @param maxRequests   Maximum allowed requests in the window (default 10)
 * @param windowSeconds Window length in seconds (default 900 = 15 min)
 */
export async function checkRateLimit(
  db: Db,
  ip: string,
  endpoint: string,
  maxRequests = 10,
  windowSeconds = 900
): Promise<RateLimitResult> {
  return _checkLimit(db, `${ip}:${endpoint}`, endpoint, maxRequests, windowSeconds);
}

/**
 * Per-user rate limit check. Keys on userId instead of IP so IP rotation
 * cannot bypass user-scoped limits.
 *
 * @param db            Mongo Db instance
 * @param userId        Authenticated user's ID (from JWT payload)
 * @param endpoint      Short label, e.g. 'upload', 'send-message'
 * @param maxRequests   Maximum allowed in window (default 20)
 * @param windowSeconds Window length in seconds (default 60)
 */
export async function checkRateLimitByUser(
  db: Db,
  userId: string,
  endpoint: string,
  maxRequests = 20,
  windowSeconds = 60
): Promise<RateLimitResult> {
  return _checkLimit(db, `user:${userId}:${endpoint}`, endpoint, maxRequests, windowSeconds);
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
