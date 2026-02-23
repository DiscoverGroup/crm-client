import type { Handler } from '@netlify/functions';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { parseRequestBody } from './middleware/validation';
import { getSecurityHeaders, getCORSHeaders, isValidEmail, isValidPassword, isValidUsername, sanitizeInput } from './utils/securityUtils';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';
const BCRYPT_SALT_ROUNDS = 12;

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
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid || !auth.user) return unauthorizedResponse(headers);

  if (!MONGODB_URI) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Database not configured' }),
    };
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  const parsed = parseRequestBody(event);
  if (!parsed.valid) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: parsed.error }),
    };
  }

  const { fullName, username, email, department, position, currentPassword, newPassword } = parsed.data;

  // ── Validate required fields ──────────────────────────────────────────────
  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 100) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Full name must be 2–100 characters' }),
    };
  }

  if (!username || !isValidUsername(username)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Username must be 3–30 characters (letters, numbers, _ or -)' }),
    };
  }

  if (!email || !isValidEmail(email)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Invalid email address' }),
    };
  }

  // Sanitise text fields
  const cleanFullName  = sanitizeInput(fullName.trim()).slice(0, 100);
  const cleanUsername  = sanitizeInput(username.trim()).slice(0, 30);
  const cleanEmail     = email.trim().toLowerCase();
  const cleanDept      = sanitizeInput((department || '').toString()).slice(0, 100);
  const cleanPosition  = sanitizeInput((position || '').toString()).slice(0, 100);

  // ── Password change validation ─────────────────────────────────────────────
  const changingPassword = Boolean(newPassword);
  if (changingPassword) {
    if (!currentPassword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Current password is required to set a new password' }),
      };
    }
    if (!isValidPassword(newPassword)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'New password must be at least 8 characters with an uppercase letter, lowercase letter, number, and special character',
        }),
      };
    }
  }

  // ── MongoDB ───────────────────────────────────────────────────────────────
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
    const usersCollection = db.collection('users');

    // Fetch current user record (by JWT userId)
    const currentUserDoc = await usersCollection.findOne({ _id: new ObjectId(auth.user.userId) });
    if (!currentUserDoc) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'User not found' }),
      };
    }

    // ── Verify current password before allowing password change ──────────────
    if (changingPassword) {
      const passwordMatch = await bcrypt.compare(currentPassword, currentUserDoc.password);
      if (!passwordMatch) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Current password is incorrect' }),
        };
      }
    }

    // ── Check email/username uniqueness (excluding self) ─────────────────────
    const conflict = await usersCollection.findOne({
      _id: { $ne: new ObjectId(auth.user.userId) },
      $or: [{ email: cleanEmail }, { username: cleanUsername }],
    });

    if (conflict) {
      const field = conflict.email === cleanEmail ? 'Email' : 'Username';
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ success: false, error: `${field} is already in use by another account` }),
      };
    }

    // ── Build update object ───────────────────────────────────────────────────
    const updateFields: Record<string, unknown> = {
      fullName:   cleanFullName,
      username:   cleanUsername,
      email:      cleanEmail,
      department: cleanDept,
      position:   cleanPosition,
      updatedAt:  new Date(),
    };

    if (changingPassword && newPassword) {
      updateFields.password = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    }

    await usersCollection.updateOne(
      { _id: new ObjectId(auth.user.userId) },
      { $set: updateFields }
    );

    // Return updated user (no password)
    const updatedUser = {
      id:          auth.user.userId,
      fullName:    cleanFullName,
      username:    cleanUsername,
      email:       cleanEmail,
      department:  cleanDept,
      position:    cleanPosition,
      profileImage:        currentUserDoc.profileImage || '',
      profileImageR2Path:  currentUserDoc.profileImageR2Path || '',
      role:        currentUserDoc.role,
      isVerified:  currentUserDoc.isVerified,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, user: updatedUser }),
    };
  } finally {
    await client.close();
  }
};
