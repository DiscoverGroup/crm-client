/**
 * Delete User — POST /.netlify/functions/delete-user
 *
 * Admin-only endpoint that permanently deletes a user from MongoDB.
 * Expects JSON body: { email: string }
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
  try {
    const body = JSON.parse(event.body || '{}');
    email = (body.email || '').toString().trim().toLowerCase();
    if (!email) throw new Error('Missing email');
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'email is required' }),
    };
  }

  // ── Prevent self-deletion ─────────────────────────────────────────────────
  if (auth.user?.email?.toLowerCase() === email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Cannot delete your own account' }),
    };
  }

  // ── Delete from MongoDB ───────────────────────────────────────────────────
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const result = await db.collection('users').deleteOne({ email });

    if (result.deletedCount === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'User not found in database' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: `User ${email} deleted from MongoDB` }),
    };
  } catch (err: any) {
    console.error('[delete-user] Error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Failed to delete user' }),
    };
  } finally {
    await client.close();
  }
};
