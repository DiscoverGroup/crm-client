import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import crypto from 'crypto';
import { checkRateLimit, tooManyRequestsResponse, getClientIP } from './utils/rateLimiter';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

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
    const { email, code } = JSON.parse(event.body || '{}');

    if (!email || !code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing email or verification code' }),
      };
    }

    const dbClient = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      tls: true,
      tlsAllowInvalidCertificates: false,
    });

    try {
      const db = dbClient.db(DB_NAME);

      // Rate limit: 5 attempts per IP per 15 minutes to prevent brute-force
      const rateLimit = await checkRateLimit(db, ip, 'verify-otp', 5, 900);
      if (rateLimit.limited) return tooManyRequestsResponse(headers);

      const user = await db.collection('users').findOne({
        email: email.trim().toLowerCase(),
      });

      // Compute hash regardless of user existence to prevent timing attacks
      const enteredHash = hashCode(String(code).trim());
      const storedHash: string = user?.verificationCodeHash || '';
      const storedExpiry: number = user?.verificationCodeExpiry || 0;

      // Check expiry first — gives user actionable feedback before checking the code
      if (!user || Date.now() > storedExpiry) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: !user ? 'Invalid or expired verification code' : 'Verification code has expired. Please request a new one.' }),
        };
      }

      // Use timingSafeEqual to prevent timing-based user enumeration
      let codeMatches = false;
      if (storedHash.length === enteredHash.length && storedHash.length > 0) {
        codeMatches = crypto.timingSafeEqual(
          Buffer.from(enteredHash, 'hex'),
          Buffer.from(storedHash, 'hex')
        );
      }

      if (!codeMatches) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Invalid verification code' }),
        };
      }

      // Mark verified and clear the OTP fields
      await db.collection('users').updateOne(
        { email: email.trim().toLowerCase() },
        {
          $set: { isVerified: true, verifiedAt: new Date() },
          $unset: { verificationCodeHash: '', verificationCodeExpiry: '' },
        }
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Email verified successfully' }),
      };
    } finally {
      await dbClient.close();
    }
  } catch {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Server error during verification' }),
    };
  }
};
