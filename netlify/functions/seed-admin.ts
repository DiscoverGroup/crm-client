/**
 * seed-admin.ts
 *
 * One-time admin account setup / password fix.
 * Creates or updates the admin user with a bcrypt-hashed password.
 *
 * Protection: caller must supply the SETUP_SECRET env-var as a
 * Bearer token so this endpoint cannot be abused by anonymous users.
 *
 * Usage (run once after deployment, or whenever the admin password
 * needs to be reset directly on the DB):
 *
 *   POST /.netlify/functions/seed-admin
 *   Authorization: Bearer <SETUP_SECRET>
 *   Content-Type: application/json
 *
 *   {} (no body required — password is read from ADMIN_PASSWORD env var)
 */

import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';

const MONGODB_URI      = process.env.MONGODB_URI      || '';
const DB_NAME          = 'dg_crm';
const SETUP_SECRET     = process.env.SETUP_SECRET     || '';   // must be set in Netlify env vars
const ADMIN_EMAIL      = process.env.ADMIN_EMAIL      || 'admin@discovergrp.com';
const ADMIN_PASSWORD   = process.env.ADMIN_PASSWORD   || '';   // must be set in Netlify env vars
const BCRYPT_ROUNDS    = 12;

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

  // ── Secret guard ────────────────────────────────────────────────────────────
  if (!SETUP_SECRET) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'SETUP_SECRET env var not configured' }),
    };
  }

  const authHeader = event.headers['authorization'] || '';
  const provided   = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!provided || provided !== SETUP_SECRET) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  // ── Env-var guards ──────────────────────────────────────────────────────────
  if (!MONGODB_URI) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'MONGODB_URI not configured' }),
    };
  }

  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'ADMIN_PASSWORD env var missing or too short' }),
    };
  }

  const dbClient = await MongoClient.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    tls: true,
    tlsAllowInvalidCertificates: false,
  });

  try {
    const db    = dbClient.db(DB_NAME);
    const users = db.collection('users');

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);

    const result = await users.updateOne(
      { email: ADMIN_EMAIL.toLowerCase() },
      {
        $set: {
          email:      ADMIN_EMAIL.toLowerCase(),
          username:   'admin',
          fullName:   'Administrator',
          password:   hashedPassword,
          role:       'admin',
          isVerified: true,
          department: 'Information & Technology Department',
          position:   'IT Manager',
          updatedAt:  new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    const action = result.upsertedCount > 0 ? 'created' : 'updated';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Admin account ${action} successfully`,
        email: ADMIN_EMAIL.toLowerCase(),
      }),
    };
  } finally {
    await dbClient.close();
  }
};
