import type { Handler } from '@netlify/functions';
import nodemailer from 'nodemailer';

// Gmail SMTP Configuration
const GMAIL_USER = process.env.GMAIL_USER || 'romanolantano.discovergrp@gmail.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'romanolantano.discovergrp@gmail.com';
const FROM_NAME = process.env.FROM_NAME || 'DG-CRM';

// Create reusable transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD
  }
});

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { email, users } = JSON.parse(event.body || '{}');

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    // Parse users array from the request (sent from frontend)
    let userList = [];
    try {
      userList = users ? JSON.parse(users) : [];
    } catch (e) {
      console.error('Error parsing users:', e);
    }

    // Find user by email
    const user = userList.find((u: any) => u.email === email);

    if (!user) {
      // Don't reveal if user exists or not for security
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'If the email exists, a reset link has been sent',
          success: true 
        })
      };
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const resetUrl = `https://dg-crm-client.netlify.app?reset=${resetToken}&email=${encodeURIComponent(email)}`;
    const expirationTime = 30; // minutes

    // Create email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0d47a1 0%, #1e7bb8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #1e7bb8; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hi ${user.fullName || user.username},</p>
            <p>We received a request to reset your password for your DG-CRM account.</p>
            <p>Click the button below to reset your password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #1e7bb8;">${resetUrl}</p>
            <p><strong>This link will expire in ${expirationTime} minutes.</strong></p>
            <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Discover Group. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
    const mailOptions = {
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: email,
      subject: 'Password Reset Request - DG-CRM',
      html: emailHtml,
      text: `Hi ${user.fullName || user.username},\n\nWe received a request to reset your password.\n\nReset your password here: ${resetUrl}\n\nThis link will expire in ${expirationTime} minutes.\n\nIf you didn't request this, please ignore this email.`
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Password reset email sent successfully',
        success: true 
      })
    };

  } catch (error: any) {
    console.error('Error sending reset email:', error);
    
    // Return more detailed error for debugging
    const errorMessage = error?.response?.body?.errors 
      ? JSON.stringify(error.response.body.errors)
      : error?.message || 'Unknown error';
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to send reset email',
        details: errorMessage,
        success: false 
      })
    };
  }
};

// Generate a secure random token
function generateResetToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
