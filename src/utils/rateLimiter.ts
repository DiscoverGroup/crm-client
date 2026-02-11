/**
 * Rate Limiting Service
 * Prevents brute force attacks, DoS attacks, and API abuse
 * Uses in-memory store (can be replaced with Redis for production)
 */

interface RateLimitEntry {
  count: number;
  firstRequestTime: number;
  lastRequestTime: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: any = null;

  constructor() {
    // Clean up old entries every 5 minutes
    this.startCleanup();
  }

  /**
   * Checks if request should be allowed
   * Returns { allowed: boolean, remaining: number, resetTime: number }
   */
  checkLimit(
    key: string,
    limit: number = 10,
    windowSeconds: number = 60
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // New entry or window expired
    if (!entry || now - entry.firstRequestTime > windowSeconds * 1000) {
      this.store.set(key, {
        count: 1,
        firstRequestTime: now,
        lastRequestTime: now
      });
      return {
        allowed: true,
        remaining: limit - 1,
        resetTime: Math.ceil((windowSeconds * 1000) / 1000)
      };
    }

    // Within window
    const remaining = limit - entry.count;
    const resetTime = Math.ceil(
      (windowSeconds * 1000 - (now - entry.firstRequestTime)) / 1000
    );

    if (entry.count < limit) {
      entry.count++;
      entry.lastRequestTime = now;
      return { allowed: true, remaining: remaining - 1, resetTime };
    }

    return { allowed: false, remaining: 0, resetTime };
  }

  /**
   * Resets rate limit for a key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Gets current rate limit info
   */
  getInfo(key: string): RateLimitEntry | undefined {
    return this.store.get(key);
  }

  /**
   * Starts cleanup of old entries
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const [key, entry] of this.store.entries()) {
        if (now - entry.lastRequestTime > maxAge) {
          this.store.delete(key);
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Stops cleanup
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Create global instance
const rateLimiter = new RateLimiter();

// ============================================
// RATE LIMIT POLICIES
// ============================================

export interface RateLimitPolicy {
  limit: number;
  windowSeconds: number;
}

/**
 * Standard rate limit policies
 */
export const RateLimitPolicies = {
  // Authentication endpoints - strict
  LOGIN: { limit: 5, windowSeconds: 60 } as RateLimitPolicy,
  REGISTER: { limit: 3, windowSeconds: 60 } as RateLimitPolicy,
  PASSWORD_RESET: { limit: 3, windowSeconds: 300 } as RateLimitPolicy,
  PASSWORD_CHANGE: { limit: 5, windowSeconds: 300 } as RateLimitPolicy,

  // API endpoints - moderate
  GET_MESSAGES: { limit: 30, windowSeconds: 60 } as RateLimitPolicy,
  SEND_MESSAGE: { limit: 20, windowSeconds: 60 } as RateLimitPolicy,
  SEARCH: { limit: 20, windowSeconds: 60 } as RateLimitPolicy,

  // File operations - moderate
  UPLOAD_FILE: { limit: 10, windowSeconds: 60 } as RateLimitPolicy,
  DOWNLOAD_FILE: { limit: 30, windowSeconds: 60 } as RateLimitPolicy,

  // General API - lenient
  GENERAL_API: { limit: 60, windowSeconds: 60 } as RateLimitPolicy
};

// ============================================
// PUBLIC API
// ============================================

/**
 * Gets client IP from request
 */
export function getClientIP(event: any): string {
  return (
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['x-real-ip'] ||
    event.headers['client-ip'] ||
    'unknown'
  );
}

/**
 * Checks if request is rate limited
 */
export function isRateLimited(
  clientIP: string,
  endpoint: string,
  policy: RateLimitPolicy
): {
  limited: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
} {
  const key = `${clientIP}:${endpoint}`;
  const result = rateLimiter.checkLimit(key, policy.limit, policy.windowSeconds);

  return {
    limited: !result.allowed,
    remaining: Math.max(0, result.remaining),
    resetTime: result.resetTime,
    retryAfter: !result.allowed ? result.resetTime : undefined
  };
}

/**
 * Gets rate limit headers for response
 */
export function getRateLimitHeaders(
  policy: RateLimitPolicy,
  rateLimitResult: ReturnType<typeof isRateLimited>
): Record<string, string> {
  return {
    'X-RateLimit-Limit': policy.limit.toString(),
    'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(Date.now() / 1000 + rateLimitResult.resetTime).toString(),
    ...(rateLimitResult.retryAfter && {
      'Retry-After': rateLimitResult.retryAfter.toString()
    })
  };
}

/**
 * Creates error response for rate limited request
 */
export function rateLimitedErrorResponse(
  rateLimitResult: ReturnType<typeof isRateLimited>,
  corsOrigin?: string
): any {
  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': (rateLimitResult.retryAfter || 60).toString(),
      'Access-Control-Allow-Origin': corsOrigin || '*'
    },
    body: JSON.stringify({
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: rateLimitResult.retryAfter
    })
  };
}

/**
 * Resets rate limit for a client (for admin use)
 */
export function resetRateLimit(clientIP: string, endpoint: string): void {
  const key = `${clientIP}:${endpoint}`;
  rateLimiter.reset(key);
}

export default rateLimiter;
