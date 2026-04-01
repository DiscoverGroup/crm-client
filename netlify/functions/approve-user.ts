/**
 * Approve/Reject User — POST /.netlify/functions/approve-user
 *
 * Admin-only endpoint that sets a user's approvalStatus to 'approved' or 'rejected'.
 * Expects JSON body: { email: string, action: 'approve' | 'reject' }
 */

import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';

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

  // ── JWT Authentication ────────────────────────────────────────────────────
  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) {
    return unauthorizedResponse(headers, auth.error);
  }

  // ── Admin check ───────────────────────────────────────────────────────────
  if (auth.user?.role !== 'admin') {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ success: false, error: 'Admin access required' }),
    };
  }

  // ── Parse request ─────────────────────────────────────────────────────────
  let email: string;
  let action: string;
  try {
    const body = JSON.parse(event.body || '{}');
    email = (body.email || '').toString().trim().toLowerCase();
    action = (body.action || '').toString().trim().toLowerCase();
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

  if (action !== 'approve' && action !== 'reject') {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Action must be "approve" or "reject"' }),
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
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const result = await db.collection('users').updateOne(
      { email },
      {
        $set: {
          approvalStatus: newStatus,
          [`${newStatus}At`]: new Date(),
          [`${newStatus}By`]: auth.user?.email || 'admin',
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
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
        message: `User ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
        approvalStatus: newStatus,
      }),
    };
  } finally {
    await client.close();
  }
};
