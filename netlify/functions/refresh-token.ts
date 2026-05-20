/**
 * Token Refresh Endpoint
 * 
 * Allows clients to exchange a valid (but soon-to-expire) JWT for a fresh one.
 * This enables sliding sessions — users stay logged in as long as they're active.
 * 
 * Security:
 * - Only accepts tokens that are still valid (not expired)
 * - Issues new token with fresh 1h expiry
 * - Rate limited to prevent abuse
 */

import type { Handler } from '@netlify/functions';
import { verifyAuthToken, generateAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import { checkRateLimitByUser, tooManyRequestsResponse } from './utils/rateLimiter';
import { getMongoDb } from './utils/mongoClient';

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
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // ── Verify current token (with grace period for expired tokens) ────────────
  const auth = verifyAuthToken(event.headers['authorization']);
  
  // If token is invalid but not due to expiry, reject immediately
  if (!auth.valid && auth.error !== 'Token has expired') {
    return unauthorizedResponse(headers, auth.error || 'Invalid token');
  }
  
  // If token is expired, check if it's within the grace period (5 minutes)
  let userId: string;
  let email: string;
  let role: 'admin' | 'user' | 'intern';
  let fullName: string | undefined;
  
  if (!auth.valid && auth.error === 'Token has expired') {
    // Manually decode the expired token to check grace period
    try {
      const authHeader = event.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return unauthorizedResponse(headers, 'Missing authorization header');
      }
      
      const token = authHeader.slice(7).trim();
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      
      // Check if token expired within the last 5 minutes (grace period)
      const expiredAt = payload.exp * 1000;
      const now = Date.now();
      const gracePeriodMs = 5 * 60 * 1000; // 5 minutes
      
      if (now - expiredAt > gracePeriodMs) {
        return unauthorizedResponse(headers, 'Token expired beyond grace period. Please log in again.');
      }
      
      // Token is within grace period, allow refresh
      userId = payload.userId;
      email = payload.email;
      role = payload.role;
      fullName = payload.fullName;
    } catch (error) {
      return unauthorizedResponse(headers, 'Invalid token format');
    }
  } else {
    // Token is still valid
    userId = auth.user!.userId;
    email = auth.user!.email;
    role = auth.user!.role;
    fullName = auth.user!.fullName;
  }

  try {
    const db = await getMongoDb();

    // ── Rate limit: 10 token refreshes per user per minute ────────────────────
    const rl = await checkRateLimitByUser(db, userId, 'refresh-token', 10, 60);
    if (rl.limited) {
      return tooManyRequestsResponse(headers, 60);
    }

    // ── Verify user still exists and is approved ───────────────────────────────
    const usersCol = db.collection('users');
    const user = await usersCol.findOne({ 
      $or: [{ id: userId }, { email: email }] 
    });

    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'User not found' 
        })
      };
    }

    // Check if user is still approved
    if ((user as any).approvalStatus === 'rejected' || (user as any).approvalStatus === 'pending') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Account access revoked or pending approval' 
        })
      };
    }

    // ── Issue fresh token ──────────────────────────────────────────────────────
    const newToken = generateAuthToken(
      userId,
      email,
      role,
      fullName || (user as any).fullName
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        token: newToken,
        expiresIn: 3600 // 1 hour in seconds
      })
    };

  } catch (error: any) {
    console.error('[refresh-token] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Failed to refresh token' 
      })
    };
  }
};
