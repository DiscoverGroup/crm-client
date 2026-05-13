/**
 * CSRF Protection Module (Server-Side) — Stateless HMAC implementation
 *
 * Uses HMAC-SHA256 signed timestamps instead of an in-memory token store.
 * This works correctly in Netlify's stateless serverless environment where
 * each function invocation is a fresh process with no shared memory.
 *
 * Token format: "<unix_seconds_hex>.<hmac_hex>"
 * Valid for up to 2 hours after issuance.
 */

import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || '';
const CSRF_WINDOW_SECONDS = 2 * 60 * 60; // 2 hours

function getSecret(): string {
  if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');
  return JWT_SECRET;
}

function signTimestamp(timestampSeconds: number): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(`csrf:${timestampSeconds}`)
    .digest('hex');
}

/**
 * Generates a stateless HMAC-signed CSRF token.
 * Safe to call in any serverless function — no storage required.
 */
function generateStatelessToken(): string {
  const ts = Math.floor(Date.now() / 1000);
  return `${ts.toString(16)}.${signTimestamp(ts)}`;
}

/**
 * Validates a stateless CSRF token.
 * Returns valid=true if the HMAC is correct and the token is within the 2-hour window.
 */
function validateStatelessToken(token: string): { valid: boolean; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is missing' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Token format invalid' };
  }

  const [tsHex, receivedHmac] = parts;
  const ts = parseInt(tsHex, 16);
  if (isNaN(ts)) {
    return { valid: false, error: 'Token format invalid' };
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - ts;
  if (ageSeconds > CSRF_WINDOW_SECONDS) {
    return { valid: false, error: 'Token has expired' };
  }
  if (ageSeconds < -60) {
    // Allow 60s clock skew, reject far-future tokens
    return { valid: false, error: 'Token timestamp is in the future' };
  }

  const expectedHmac = signTimestamp(ts);
  try {
    const expected = Buffer.from(expectedHmac, 'hex');
    const received = Buffer.from(receivedHmac, 'hex');
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      return { valid: false, error: 'Token is invalid' };
    }
  } catch {
    return { valid: false, error: 'Token is invalid' };
  }

  return { valid: true };
}

// Legacy shim — kept so the class-based default export still satisfies any direct imports
const csrfProtection = {
  getToken: generateStatelessToken,
  generateToken: (_minutes?: number) => generateStatelessToken(),
  validateToken: (token: string, _consume?: boolean) => validateStatelessToken(token),
};

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
