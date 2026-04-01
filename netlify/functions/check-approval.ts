/**
 * Check Approval Status — POST /.netlify/functions/check-approval
 *
 * Public endpoint (no auth required) that returns a user's approval status.
 * Used by the waiting page to poll for admin approval.
 * Expects JSON body: { email: string }
 */

import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import { checkRateLimit, tooManyRequestsResponse, getClientIP } from './utils/rateLimiter';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';

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
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let email: string;
  try {
    const body = JSON.parse(event.body || '{}');
    email = (body.email || '').toString().trim().toLowerCase();
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Invalid request body' }),
    };
  }

  if (!email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Email is required' }),
    };
  }

  if (!MONGODB_URI) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Database not configured' }),
    };
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

    // Rate limit: 30 checks per IP per 15 min (polling)
    const ip = getClientIP(event.headers as Record<string, string>);
    const rateLimit = await checkRateLimit(db, ip, 'check-approval', 30, 900);
    if (rateLimit.limited) {
      return tooManyRequestsResponse(headers);
    }

    const user = await db.collection('users').findOne(
      { email },
      { projection: { approvalStatus: 1 } }
    );

    if (!user) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'User not found' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        approvalStatus: user.approvalStatus || 'pending',
      }),
    };
  } finally {
    await client.close();
  }
};
