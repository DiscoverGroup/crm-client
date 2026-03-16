/**
 * Auth0 Sync — POST /.netlify/functions/auth0-sync
 *
 * Called by the frontend after a successful Auth0 signup popup.
 * 1. Validates the Auth0 access token by calling Auth0's /userinfo endpoint.
 * 2. Creates the user in MongoDB if they don't already exist.
 * 3. Returns a CRM JWT so the user is immediately logged in.
 */

import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import { generateAuthToken } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';

const MONGODB_URI = process.env.MONGODB_URI || '';
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || '';
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

  if (!AUTH0_DOMAIN) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'AUTH0_DOMAIN is not configured' }),
    };
  }

  if (!MONGODB_URI) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'MONGODB_URI is not configured' }),
    };
  }

  let accessToken: string;
  try {
    const body = JSON.parse(event.body || '{}');
    accessToken = body.accessToken;
    if (!accessToken) throw new Error('Missing accessToken');
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'accessToken is required' }),
    };
  }

  // ── 1. Verify token by calling Auth0 /userinfo ─────────────────────────────
  let auth0User: {
    sub: string;
    email: string;
    name?: string;
    nickname?: string;
    picture?: string;
    email_verified?: boolean;
  };

  try {
    const userInfoRes = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoRes.ok) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid or expired Auth0 token' }),
      };
    }

    auth0User = await userInfoRes.json();
  } catch {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ success: false, error: 'Failed to reach Auth0 userinfo endpoint' }),
    };
  }

  if (!auth0User.email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Auth0 account has no email. Enable email scope.' }),
    };
  }

  // ── 2. Create or find user in MongoDB ─────────────────────────────────────
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const users = db.collection('users');

    let user = await users.findOne({ email: auth0User.email.toLowerCase() });

    if (!user) {
      // Derive a unique username from email
      const baseUsername = auth0User.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
      let username = baseUsername;
      let counter = 1;
      while (await users.findOne({ username })) {
        username = `${baseUsername}${counter++}`;
      }

      const fullName = auth0User.name || auth0User.nickname || username;

      const newUser = {
        username,
        email: auth0User.email.toLowerCase(),
        fullName,
        password: '', // No password for Auth0 users
        department: '',
        position: '',
        profileImage: auth0User.picture || '',
        isVerified: true, // Auth0 verifies email
        role: 'user' as const,
        auth0Sub: auth0User.sub,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await users.insertOne(newUser);
      user = { ...newUser, _id: result.insertedId };
    } else if (!user.auth0Sub) {
      // Existing local user — link their Auth0 sub
      await users.updateOne(
        { _id: user._id },
        { $set: { auth0Sub: auth0User.sub, updatedAt: new Date().toISOString() } }
      );
    }

    // ── 3. Issue CRM JWT ─────────────────────────────────────────────────────
    const token = generateAuthToken(
      String(user._id),
      user.email,
      (user.role as 'admin' | 'user' | 'intern') ?? 'user',
      user.fullName
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        token,
        user: {
          id: String(user._id),
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          department: user.department || '',
          position: user.position || '',
          profileImage: user.profileImage || '',
          isVerified: true,
          role: user.role ?? 'user',
        },
        isNewUser: !user.auth0Sub,
      }),
    };
  } finally {
    await client.close();
  }
};
