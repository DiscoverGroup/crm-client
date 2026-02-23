import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { checkRateLimit, tooManyRequestsResponse, getClientIP } from './utils/rateLimiter';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const handler: Handler = async (event) => {
  const headers = {
    ...getCORSHeaders(process.env.ALLOWED_ORIGIN),
    ...getSecurityHeaders(),
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!MONGODB_URI) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  try {
    const ip = getClientIP(event.headers as Record<string, string>);
    const { email, token, newPassword } = JSON.parse(event.body || '{}');

    if (!email || !token || !newPassword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Password must be at least 8 characters long' }),
      };
    }

    const dbClient = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      tls: true,
      tlsAllowInvalidCertificates: false,
    });

    try {
      const db = dbClient.db(DB_NAME);

      // Rate limit: 5 reset attempts per IP per 15 minutes
      const rateLimit = await checkRateLimit(db, ip, 'reset-password', 5, 900);
      if (rateLimit.limited) return tooManyRequestsResponse(headers);

      const user = await db.collection('users').findOne({
        email: email.trim().toLowerCase(),
      });

      if (!user) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid or expired reset token' }),
        };
      }

      // Validate reset token
      const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
      const storedHash: string = user.passwordResetTokenHash || '';
      const storedExpiry: number = user.passwordResetExpiry || 0;

      let tokenValid = false;
      if (storedHash.length === tokenHash.length && storedHash.length > 0) {
        tokenValid = crypto.timingSafeEqual(
          Buffer.from(tokenHash, 'hex'),
          Buffer.from(storedHash, 'hex')
        );
      }

      if (!tokenValid || Date.now() > storedExpiry) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid or expired reset token. Please request a new password reset.' }),
        };
      }

      // Hash new password and update, clearing reset token fields
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      await db.collection('users').updateOne(
        { email: email.trim().toLowerCase() },
        {
          $set: { password: hashedPassword, passwordUpdatedAt: new Date() },
          $unset: { passwordResetTokenHash: '', passwordResetExpiry: '' },
        }
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Password reset successfully' }),
      };
    } finally {
      await dbClient.close();
    }
  } catch {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to reset password', success: false }),
    };
  }
};
