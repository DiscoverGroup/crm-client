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

// Create reusable transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD
  }
});

/** Hash the OTP with SHA-256 before storing (never store plaintext codes). */
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
    const body = JSON.parse(event.body || '{}');
    // Accept only email + fullName — intentionally ignore any 'verificationCode' from client
    const { email, fullName } = body;

    if (!email || typeof email !== 'string' || !fullName || typeof fullName !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email and full name are required' }),
      };
    }

    const dbClient = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      tls: true,
      tlsAllowInvalidCertificates: false,
    });

    try {
      const db = dbClient.db(DB_NAME);

      // Rate limit: 3 verification emails per IP per 10 minutes
      const rateLimit = await checkRateLimit(db, ip, 'send-verification', 3, 600);
      if (rateLimit.limited) return tooManyRequestsResponse(headers, 600);

      // Generate OTP server-side
      const plainCode = crypto.randomInt(100000, 999999).toString();
      const hashedCode = hashCode(plainCode);
      const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Store hashed code in MongoDB (never the plain code)
      await db.collection('users').updateOne(
        { email: email.trim().toLowerCase() },
        { $set: { verificationCodeHash: hashedCode, verificationCodeExpiry: expiry } }
      );

      // Build and send email with plain OTP
      const emailHtml = `
        <!DOCTYPE html><html><head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0d47a1 0%, #1e7bb8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .code-box { background: white; border: 2px dashed #1e7bb8; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0d47a1; font-family: 'Courier New', monospace; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head><body>
          <div class="container">
            <div class="header"><h1>Verify Your Email</h1></div>
            <div class="content">
              <p>Hi ${fullName},</p>
              <p>Welcome to DG-CRM! Use the code below to verify your email address:</p>
              <div class="code-box">
                <p style="margin:0;font-size:14px;color:#666;">Your Verification Code</p>
                <p class="code">${plainCode}</p>
              </div>
              <p><strong>This code expires in 10 minutes.</strong></p>
              <p>If you didn't create an account, please ignore this email.</p>
              <div class="footer"><p>&copy; ${new Date().getFullYear()} Discover Group. All rights reserved.</p></div>
            </div>
          </div>
        </body></html>`;

      await transporter.sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to: email.trim(),
        subject: 'Your DG-CRM Verification Code',
        html: emailHtml,
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Verification email sent' }),
      };
    } finally {
      await dbClient.close();
    }
  } catch {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to send verification email', success: false }),
    };
  }
};
