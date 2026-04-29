import type { Handler } from '@netlify/functions';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { MongoClient } from 'mongodb';
import { checkRateLimit, tooManyRequestsResponse, getClientIP } from './utils/rateLimiter';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';

// Gmail SMTP Configuration
const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';
const FROM_EMAIL = process.env.FROM_EMAIL || '';
const FROM_NAME = process.env.FROM_NAME || 'DG-CRM';
const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';
const SITE_URL = 'https://dg-crm-client.netlify.app';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
});

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
    // Accept only 'email' — never trust a 'users' list from the client
    const { email } = JSON.parse(event.body || '{}');

    if (!email || typeof email !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email is required' }) };
    }

    const dbClient = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      tls: true,
      tlsAllowInvalidCertificates: false,
    });

    try {
      const db = dbClient.db(DB_NAME);

      // Rate limit: 3 reset emails per IP per 15 minutes
      const rateLimit = await checkRateLimit(db, ip, 'send-reset', 3, 900);
      if (rateLimit.limited) return tooManyRequestsResponse(headers, 900);

      // Query MongoDB directly — never trust client-supplied user data
      const user = await db.collection('users').findOne({
        email: email.trim().toLowerCase(),
      });

      // Always respond with the same message to prevent user enumeration
      if (!user) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, message: 'If the email exists, a reset link has been sent' }),
        };
      }

      // Generate reset token, hash for storage
      const plainToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
      const expiry = Date.now() + 30 * 60 * 1000; // 30 minutes

      await db.collection('users').updateOne(
        { email: email.trim().toLowerCase() },
        { $set: { passwordResetTokenHash: tokenHash, passwordResetExpiry: expiry } }
      );

      const resetUrl = `${SITE_URL}?reset=${plainToken}&email=${encodeURIComponent(email.trim())}`;

      const emailHtml = `
        <!DOCTYPE html><html><head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg,#0d47a1 0%,#1e7bb8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #1e7bb8; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head><body>
          <div class="container">
            <div class="header"><h1>Password Reset Request</h1></div>
            <div class="content">
              <p>Hi ${user.fullName || user.username},</p>
              <p>Click the button below to reset your DG-CRM password. This link expires in 30 minutes.</p>
              <p style="text-align:center;"><a href="${resetUrl}" class="button">Reset Password</a></p>
              <p style="word-break:break-all;color:#1e7bb8;">${resetUrl}</p>
              <p>If you didn&apos;t request a password reset, please ignore this email.</p>
              <div class="footer"><p>&copy; ${new Date().getFullYear()} Discover Group. All rights reserved.</p></div>
            </div>
          </div>
        </body></html>`;

      await transporter.sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to: email.trim(),
        subject: 'Password Reset Request - DG-CRM',
        html: emailHtml,
        text: `Hi ${user.fullName || user.username},\n\nReset your password: ${resetUrl}\n\nThis link expires in 30 minutes.`,
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'If the email exists, a reset link has been sent' }),
      };
    } finally {
      await dbClient.close();
    }
  } catch {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to process request', success: false }),
    };
  }
};
