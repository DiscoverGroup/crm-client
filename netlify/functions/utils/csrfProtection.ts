/**
 * CSRF Protection Module (Server-Side)
 * Cross-Site Request Forgery protection for Netlify Functions
 */

import crypto from 'crypto';

interface CSRFTokenStore {
  token: string;
  hash: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

/**
 * CSRF Protection Manager (Server-Side)
 */
class CSRFProtection {
  // Store tokens with their hashes
  private tokenStore: Map<string, CSRFTokenStore> = new Map();
  private cleanupInterval: any = null;

  constructor() {
    this.startCleanup();
  }

  /**
   * Generates a new CSRF token
   * @param expirationMinutes How long token is valid (default 1 hour)
   */
  generateToken(expirationMinutes: number = 60): string {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = this.hashToken(token);
    const now = Date.now();

    this.tokenStore.set(hash, {
      token,
      hash,
      createdAt: now,
      expiresAt: now + expirationMinutes * 60 * 1000,
      used: false
    });

    return token;
  }

  /**
   * Validates a CSRF token
   * @param token The token to validate
   * @param consumeToken Whether to mark token as used (prevents replay)
   */
  validateToken(token: string, consumeToken: boolean = true): { valid: boolean; error?: string } {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token is missing' };
    }

    const hash = this.hashToken(token);
    const entry = this.tokenStore.get(hash);

    if (!entry) {
      return { valid: false, error: 'Token is invalid' };
    }

    // Check if token has expired
    if (Date.now() > entry.expiresAt) {
      this.tokenStore.delete(hash);
      return { valid: false, error: 'Token has expired' };
    }

    // Check if token has already been used (prevent replay)
    if (entry.used) {
      this.tokenStore.delete(hash);
      return { valid: false, error: 'Token has already been used' };
    }

    // Mark as used if requested
    if (consumeToken) {
      entry.used = true;
      // Set to expire in 5 seconds (for cleanup)
      entry.expiresAt = Date.now() + 5000;
    }

    return { valid: true };
  }

  /**
   * Gets a new token for a form/request
   */
  getToken(): string {
    return this.generateToken(60);
  }

  /**
   * Hashes a token for storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Starts automatic cleanup of expired tokens
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();

      for (const [hash, entry] of this.tokenStore.entries()) {
        if (now > entry.expiresAt) {
          this.tokenStore.delete(hash);
        }
      }
    }, 10 * 60 * 1000); // Every 10 minutes
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

// Global instance
const csrfProtection = new CSRFProtection();

export default csrfProtection;

// ============================================
// PUBLIC API
// ============================================

/**
 * Gets a CSRF token for the frontend
 * Call this endpoint to get a fresh token before forms
 */
export function generateCSRFToken(expirationMinutes: number = 60): string {
  return csrfProtection.getToken();
}

/**
 * Validates incoming CSRF token
 * Call this in POST/PUT/DELETE handlers
 */
export function validateCSRFToken(token: string): { valid: boolean; error?: string } {
  return csrfProtection.validateToken(token, true);
}

/**
 * Gets CSRF token header name
 */
export const CSRF_TOKEN_HEADER = 'X-CSRF-Token';

/**
 * Extracts CSRF token from request
 * Check headers and body
 */
export function extractCSRFToken(event: any): string | undefined {
  // Check header first
  const headerToken = event.headers?.[CSRF_TOKEN_HEADER.toLowerCase()];
  if (headerToken) return headerToken;

  // Check query parameters
  if (event.queryStringParameters?.csrfToken) {
    return event.queryStringParameters.csrfToken;
  }

  // Try to parse body
  try {
    const body = JSON.parse(event.body || '{}');
    if (body.csrfToken) return body.csrfToken;
  } catch {}

  return undefined;
}

/**
 * Response header for setting CSRF token cookie
 */
export function getCSRFTokenCookie(token: string, secure: boolean = true): string {
  const httpOnly = 'HttpOnly';
  const sameSite = 'SameSite=Strict';
  const sslFlag = secure ? '; Secure' : '';
  return `CSRF-TOKEN=${token}; ${httpOnly}; ${sameSite}; Path=/${sslFlag}`;
}

/**
 * Validates CSRF in request
 * Use this in your handlers before processing state-changing requests
 */
export function validateCSRFInRequest(event: any): { valid: boolean; error?: string } {
  // Skip validation for GET requests
  if (event.httpMethod === 'GET' || event.httpMethod === 'OPTIONS') {
    return { valid: true };
  }

  // Skip validation if explicitly disabled (e.g., for public APIs)
  if (event.headers?.['x-csrf-skip'] === 'true') {
    return { valid: true };
  }

  const token = extractCSRFToken(event);
  if (!token) {
    return { valid: false, error: 'CSRF token is missing' };
  }

  return validateCSRFToken(token);
}

/**
 * Gets CSRF validation result as HTTP headers
 */
export function getCSRFErrorHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-CSRF-Error': 'true'
  };
}
