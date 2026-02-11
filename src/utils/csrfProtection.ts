/**
 * CSRF Protection Service (Browser)
 * Client-side CSRF token management
 * For server-side token generation, use netlify/functions/utils/csrfProtection.ts
 */

interface CSRFTokenStore {
  token: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

/**
 * CSRF Protection Manager (Browser)
 * Manages tokens received from server
 */
class CSRFProtection {
  // Store tokens received from server
  private tokenStore: Map<string, CSRFTokenStore> = new Map();
  private cleanupInterval: any = null;

  constructor() {
    this.startCleanup();
  }

  /**
   * Store a token received from the server
   * @param token The CSRF token from server response headers or cookies
   * @param expirationMinutes How long token is valid
   */
  storeToken(token: string, expirationMinutes: number = 60): void {
    if (!token || typeof token !== 'string') return;
    
    const now = Date.now();
    this.tokenStore.set(token, {
      token,
      createdAt: now,
      expiresAt: now + expirationMinutes * 60 * 1000,
      used: false
    });
  }

  /**
   * Validates a CSRF token received from server
   * @param token The token to validate
   * @param consumeToken Whether to mark token as used (prevents replay)
   */
  validateToken(token: string, consumeToken: boolean = true): { valid: boolean; error?: string } {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token is missing' };
    }

    const entry = this.tokenStore.get(token);

    if (!entry) {
      return { valid: false, error: 'Token is invalid' };
    }

    // Check if token has expired
    if (Date.now() > entry.expiresAt) {
      this.tokenStore.delete(token);
      return { valid: false, error: 'Token has expired' };
    }

    // Check if token has already been used (prevent replay)
    if (entry.used) {
      this.tokenStore.delete(token);
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
   * Gets the current stored CSRF token
   */
  getToken(): string | null {
    // Return the first non-expired, non-used token
    for (const [, entry] of this.tokenStore) {
      if (Date.now() <= entry.expiresAt && !entry.used) {
        return entry.token;
      }
    }
    return null;
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
 * Gets a CSRF token (for browser, uses stored token from server)
 */
export function generateCSRFToken(): string | null {
  return csrfProtection.getToken();
}

/**
 * Store a CSRF token received from server
 */
export function storeCSRFToken(token: string): void {
  csrfProtection.storeToken(token);
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
