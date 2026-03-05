/**
 * JWT Authentication Middleware
 * Verifies the Bearer token on every protected Netlify Function request.
 *
 * Usage in a handler:
 *   const auth = verifyAuthToken(event.headers['authorization']);
 *   if (!auth.valid) return unauthorizedResponse(headers);
 *   const { userId, role } = auth.user;
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthPayload {
  userId: string;
  email: string;
  role: 'admin' | 'user';
  fullName?: string;
  iat?: number;
  exp?: number;
}

export interface AuthResult {
  valid: boolean;
  user?: AuthPayload;
  error?: string;
}

// ─── Core verification ────────────────────────────────────────────────────────

/**
 * Verifies the JWT in the Authorization header.
 * Accepts "Authorization: Bearer <token>"
 */
export function verifyAuthToken(authorizationHeader: string | undefined): AuthResult {
  if (!JWT_SECRET) {
    console.error('[Auth] JWT_SECRET is not configured');
    return { valid: false, error: 'Server misconfiguration' };
  }

  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or malformed Authorization header' };
  }

  const token = authorizationHeader.slice(7).trim();

  if (!token) {
    return { valid: false, error: 'Empty token' };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    return { valid: true, user: decoded };
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return { valid: false, error: 'Token has expired' };
    }
    if (err.name === 'JsonWebTokenError') {
      return { valid: false, error: 'Invalid token' };
    }
    return { valid: false, error: 'Token verification failed' };
  }
}

/**
 * Generates a signed JWT token after successful login.
 * @param userId    MongoDB _id as string
 * @param email     User's email
 * @param role      'admin' | 'user'
 * @param fullName  User's display name (stored in token to avoid extra DB lookups)
 */
export function generateAuthToken(userId: string, email: string, role: 'admin' | 'user', fullName?: string): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(
    { userId, email, role, ...(fullName ? { fullName } : {}) },
    JWT_SECRET,
    { expiresIn: '24h', algorithm: 'HS256' }
  );
}

// ─── Response helpers ─────────────────────────────────────────────────────────

/**
 * Returns a 401 Unauthorized response body.
 * Pass your existing headers object so CORS headers are preserved.
 */
export function unauthorizedResponse(headers: Record<string, string>, message = 'Unauthorized') {
  return {
    statusCode: 401,
    headers,
    body: JSON.stringify({ success: false, error: message }),
  };
}

/**
 * Returns a 403 Forbidden response body (authenticated but insufficient role).
 */
export function forbiddenResponse(headers: Record<string, string>, message = 'Forbidden') {
  return {
    statusCode: 403,
    headers,
    body: JSON.stringify({ success: false, error: message }),
  };
}

/**
 * Quick role check — returns true only if the decoded user has the 'admin' role.
 */
export function isAdmin(user: AuthPayload): boolean {
  return user.role === 'admin';
}
