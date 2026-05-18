/**
 * Add User — POST /.netlify/functions/add-user
 *
 * Admin-only endpoint that creates a new user account directly (bypassing
 * self-signup and approval flow). Optionally auto-approves and auto-verifies
 * the user so they can log in immediately with the temporary password.
 *
 * Request body:
 * {
 *   username: string,        // 3-32 chars
 *   email: string,
 *   password: string,        // 12-128 chars, complexity enforced
 *   fullName: string,
 *   department: string,
 *   position: string,
 *   role?: 'admin' | 'user' | 'intern',  // default 'user'
 *   autoApprove?: boolean,   // default true
 *   autoVerify?: boolean,    // default true
 * }
 */

import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import { validateCSRFToken, extractCSRFToken } from './utils/csrfProtection';
import { checkRateLimit, tooManyRequestsResponse, getClientIP } from './utils/rateLimiter';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';
const BCRYPT_SALT_ROUNDS = 12;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 128;
const ALLOWED_ROLES = new Set(['admin', 'user', 'intern']);

function validatePassword(pw: string): { ok: boolean; error?: string } {
  if (typeof pw !== 'string') return { ok: false, error: 'Password is required' };
  if (pw.length < PASSWORD_MIN) return { ok: false, error: `Password must be at least ${PASSWORD_MIN} characters` };
  if (pw.length > PASSWORD_MAX) return { ok: false, error: `Password must be at most ${PASSWORD_MAX} characters` };
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasDigit = /[0-9]/.test(pw);
  const hasSpecial = /[^A-Za-z0-9]/.test(pw);
  if (!(hasUpper && hasLower && hasDigit && hasSpecial)) {
    return { ok: false, error: 'Password must include upper, lower, digit, and special character' };
  }
  return { ok: true };
}

function sanitizeShort(s: unknown, max = 120): string {
  return String(s ?? '').trim().slice(0, max);
}

export const handler: Handler = async (event) => {
  const headers = {
    ...getCORSHeaders(process.env.ALLOWED_ORIGIN),
    ...getSecurityHeaders(),
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  // ── CSRF ───────────────────────────────────────────────────────────────────
  const csrfToken = extractCSRFToken(event);
  const csrfResult = validateCSRFToken(csrfToken ?? '');
  if (!csrfResult.valid) {
    return { statusCode: 403, headers, body: JSON.stringify({ success: false, error: 'Invalid or missing CSRF token' }) };
  }

  // ── JWT Auth ──────────────────────────────────────────────────────────────
  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) {
    return unauthorizedResponse(headers, auth.error);
  }
  if (auth.user?.role !== 'admin') {
    return { statusCode: 403, headers, body: JSON.stringify({ success: false, error: 'Admin access required' }) };
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body || '{}') as Record<string, unknown>;
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Invalid JSON' }) };
  }

  const username = sanitizeShort(body.username, 32).toLowerCase();
  const email = sanitizeShort(body.email, 254).toLowerCase();
  const password = String(body.password ?? '');
  const fullName = sanitizeShort(body.fullName, 120);
  const department = sanitizeShort(body.department, 60);
  const position = sanitizeShort(body.position, 60);
  const requestedRole = sanitizeShort(body.role, 16).toLowerCase() || 'user';
  const autoApprove = body.autoApprove !== false; // default true
  const autoVerify = body.autoVerify !== false;   // default true

  // ── Validation ────────────────────────────────────────────────────────────
  if (!USERNAME_RE.test(username)) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Username must be 3-32 chars, letters/numbers/._- only' }) };
  }
  if (!EMAIL_RE.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Invalid email' }) };
  }
  const pwCheck = validatePassword(password);
  if (!pwCheck.ok) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: pwCheck.error }) };
  }
  if (!fullName) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Full name is required' }) };
  }
  if (!department) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Department is required' }) };
  }
  if (!position) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Position is required' }) };
  }
  if (!ALLOWED_ROLES.has(requestedRole)) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Invalid role' }) };
  }

  if (!MONGODB_URI) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Database not configured' }) };
  }

  const client = await MongoClient.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    tls: true,
    tlsAllowInvalidCertificates: false,
    retryWrites: true,
    w: 'majority',
  });

  try {
    const db = client.db(DB_NAME);

    // ── Rate limit: 30 admin user-creates per IP per 15 min ─────────────────
    const ip = getClientIP(event.headers as Record<string, string>);
    const rl = await checkRateLimit(db, ip, 'add-user', 30, 900);
    if (rl.limited) return tooManyRequestsResponse(headers, 900);

    const users = db.collection('users');

    const existing = await users.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      const field = existing.email === email ? 'Email' : 'Username';
      return { statusCode: 409, headers, body: JSON.stringify({ success: false, error: `${field} already in use` }) };
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const now = new Date();
    const createdBy = auth.user?.email || 'admin';

    const newUser = {
      username,
      email,
      password: passwordHash,
      fullName,
      department,
      position,
      profileImage: '',
      role: requestedRole as 'admin' | 'user' | 'intern',
      isVerified: !!autoVerify,
      approvalStatus: autoApprove ? 'approved' : 'pending',
      ...(autoApprove ? { approvedAt: now, approvedBy: createdBy } : {}),
      createdAt: now,
      updatedAt: now,
      createdBy,
      createdVia: 'admin-add-user',
    };

    const result = await users.insertOne(newUser);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'User created successfully',
        user: {
          id: result.insertedId,
          username,
          email,
          fullName,
          department,
          position,
          role: newUser.role,
          isVerified: newUser.isVerified,
          approvalStatus: newUser.approvalStatus,
          createdAt: now,
        },
      }),
    };
  } catch (err) {
    console.error('add-user error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Server error' }) };
  } finally {
    await client.close();
  }
};
