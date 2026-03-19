/**
 * GET /.netlify/functions/get-users
 * Admin-only: returns all users from MongoDB (no password hashes).
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

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) {
    return unauthorizedResponse(headers, auth.error);
  }

  // Admin-only
  if (auth.user?.role !== 'admin') {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Admin access required' }),
    };
  }

  if (!MONGODB_URI) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'MONGODB_URI not configured' }),
    };
  }

  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    tls: true,
    tlsAllowInvalidCertificates: false,
    retryWrites: true,
    w: 'majority',
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const usersCollection = db.collection('users');

    const rawUsers = await usersCollection
      .find({}, {
        // Explicitly exclude password hash
        projection: { password: 0, verificationToken: 0, verificationTokenExpiry: 0, resetToken: 0, resetTokenExpiry: 0 },
      })
      .sort({ createdAt: 1 })
      .toArray();

    // Deduplicate by email — keep the entry with highest role, then newest date
    const roleRank: Record<string, number> = { admin: 3, user: 2, intern: 1 };
    const emailMap = new Map<string, any>();
    for (const u of rawUsers) {
      const key = (u.email || '').toLowerCase();
      if (!key) continue;
      const existing = emailMap.get(key);
      if (!existing) {
        emailMap.set(key, u);
      } else {
        const newRank = roleRank[u.role ?? 'user'] ?? 2;
        const oldRank = roleRank[existing.role ?? 'user'] ?? 2;
        const newDate = new Date(u.updatedAt || u.createdAt || u.registeredAt || 0).getTime();
        const oldDate = new Date(existing.updatedAt || existing.createdAt || existing.registeredAt || 0).getTime();
        // Prefer higher role; break ties by newest date
        if (newRank > oldRank || (newRank === oldRank && newDate > oldDate)) {
          emailMap.set(key, u);
        }
      }
    }

    const users = Array.from(emailMap.values()).map((u: any) => ({
      id: String(u._id),
      email: u.email || '',
      username: u.username || '',
      fullName: u.fullName || '',
      department: u.department || '',
      position: u.position || '',
      profileImage: u.profileImage || '',
      isVerified: u.isVerified ?? false,
      role: u.role ?? 'user',
      // Distinguish Auth0 vs manual — only expose boolean flag, not the raw sub
      registrationMethod: u.auth0Sub ? 'auth0' : 'manual',
      createdAt: u.createdAt || u.registeredAt || null,
      registeredAt: u.registeredAt || u.createdAt || null,
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, users }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch users' }),
    };
  } finally {
    await client.close();
  }
};
