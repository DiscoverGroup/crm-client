import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { generateAuthToken } from './middleware/authMiddleware';
import { validateLoginRequest, parseRequestBody } from './middleware/validation';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import { checkRateLimit, tooManyRequestsResponse, getClientIP } from './utils/rateLimiter';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';

export const handler: Handler = async (event) => {
  // Restricted CORS + security headers
  const headers = {
    ...getCORSHeaders(process.env.ALLOWED_ORIGIN),
    ...getSecurityHeaders(),
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Check if MongoDB URI is configured
  if (!MONGODB_URI || MONGODB_URI === 'mongodb://localhost:27017') {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'MONGODB_URI not configured' 
      })
    };
  }

  try {
    // ── Rate limiting: 10 attempts per IP per 15 minutes ─────────────────────
    const ip = getClientIP(event.headers as Record<string, string>);

    // ── Parse & validate body ─────────────────────────────────────────────────
    const parsed = parseRequestBody(event);
    if (!parsed.valid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: parsed.error }),
      };
    }
    const validation = validateLoginRequest(parsed.data);
    if (!validation.valid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, errors: validation.errors }),
      };
    }
    const { email, password } = validation.data;

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

      // ── Rate limit check (needs DB connection) ─────────────────────────────
      const rateLimit = await checkRateLimit(db, ip, 'login', 10, 900);
      if (rateLimit.limited) {
        return tooManyRequestsResponse(headers);
      }

      const usersCollection = db.collection('users');

      // Find user by email or username
      const user = await usersCollection.findOne({
        $or: [
          { email: email.trim() },
          { username: email.trim() }
        ]
      });

      if (!user) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Invalid email/username or password' 
          })
        };
      }

      // ── Verify password with bcrypt (constant-time comparison) ──────────────
      const passwordMatch = await bcrypt.compare(password.trim(), user.password);
      if (!passwordMatch) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Invalid email/username or password' 
          })
        };
      }

      // Check if email is verified
      if (user.isVerified === false) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Email not verified',
            needsVerification: true
          })
        };
      }

      // Check if account is approved by admin
      if (user.approvalStatus === 'pending') {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Your account is pending admin approval. Please wait for an administrator to approve your registration.',
            pendingApproval: true
          })
        };
      }

      if (user.approvalStatus === 'rejected') {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Your registration has been rejected by an administrator. Please contact support for more information.',
            rejected: true
          })
        };
      }

      // ── Build safe response payload ──────────────────────────────────────────────
      const userData = {
        id: user._id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        department: user.department,
        position: user.position,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
        role: user.role ?? 'user',
      };

      // ── Generate signed JWT ─────────────────────────────────────────────────────
      const token = generateAuthToken(
        String(user._id),
        user.email,
        userData.role as 'admin' | 'user' | 'intern',
        user.fullName
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          token,          // <─ JWT; store in memory / httpOnly cookie on client
          user: userData,
          message: 'Login successful',
        }),
      };

    } finally {
      await client.close();
    }

  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Server error during login' 
      })
    };
  }
};
