import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { validateRegistrationRequest, parseRequestBody } from './middleware/validation';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import { checkRateLimit, tooManyRequestsResponse, getClientIP } from './utils/rateLimiter';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';
const BCRYPT_SALT_ROUNDS = 12;

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
    // ── Rate limiting (10 registrations per IP per 15 min) ──────────────────
    const ip = getClientIP(event.headers as Record<string, string>);

    // ── Parse & validate input ────────────────────────────────────────────────
    const parsed = parseRequestBody(event);
    if (!parsed.valid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: parsed.error }),
      };
    }
    const { username, email, password, fullName, department, position, profileImage } = parsed.data;

    // Validate required fields
    if (!username || !email || !password || !fullName || !department || !position) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'All fields are required' }),
      };
    }

    const validation = validateRegistrationRequest(parsed.data);
    if (!validation.valid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, errors: validation.errors }),
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

      // ── Rate limit check (needs DB connection) ─────────────────────────────
      const rateLimit = await checkRateLimit(db, ip, 'register', 10, 900);
      if (rateLimit.limited) {
        return tooManyRequestsResponse(headers);
      }

      const usersCollection = db.collection('users');

      // Check if email or username already exists
      const existingUser = await usersCollection.findOne({
        $or: [
          { email: email.trim() },
          { username: username.trim() }
        ]
      });

      if (existingUser) {
        if (existingUser.email === email.trim()) {
          return {
            statusCode: 409,
            headers,
            body: JSON.stringify({ 
              success: false, 
              error: 'Email already registered' 
            })
          };
        } else {
          return {
            statusCode: 409,
            headers,
            body: JSON.stringify({ 
              success: false, 
              error: 'Username already taken' 
            })
          };
        }
      }

      // Create new user
      // Automatically assign admin role to admin@discovergrp.com
      const isAdminEmail = email.trim().toLowerCase() === 'admin@discovergrp.com';
      
      const newUser = {
        username: username.trim(),
        email: email.trim(),
        password: await bcrypt.hash(password.trim(), BCRYPT_SALT_ROUNDS),
        fullName: fullName.trim(),
        department: department.trim(),
        position: position.trim(),
        profileImage: profileImage || '',
        role: isAdminEmail ? 'admin' : 'user', // Admin role for admin email
        isVerified: isAdminEmail ? true : false, // Auto-verify admin
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await usersCollection.insertOne(newUser);

      // Return user data (without password)
      const userData = {
        id: result.insertedId,
        email: newUser.email,
        username: newUser.username,
        fullName: newUser.fullName,
        department: newUser.department,
        position: newUser.position,
        profileImage: newUser.profileImage,
        role: newUser.role,
        isVerified: newUser.isVerified
      };

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          success: true, 
          user: userData,
          message: 'Registration successful. Please verify your email.',
          needsVerification: true
        })
      };

    } finally {
      await client.close();
    }

  } catch (error) {
    console.error('Registration error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Server error during registration' 
      })
    };
  }
};
