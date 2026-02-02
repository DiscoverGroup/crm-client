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
    const { email, fullName, verificationCode } = JSON.parse(event.body || '{}');

    if (!email || !fullName || !verificationCode) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

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
          .code-box { background: white; border: 2px dashed #1e7bb8; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0d47a1; font-family: 'Courier New', monospace; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Verify Your Email</h1>
          </div>
          <div class="content">
            <p>Hi ${fullName},</p>
            <p>Welcome to DG-CRM! To complete your registration, please use the verification code below:</p>
            <div class="code-box">
              <p style="margin: 0; font-size: 14px; color: #666;">Your Verification Code</p>
              <p class="code">${verificationCode}</p>
            </div>
            <p style="text-align: center; color: #666;">Enter this code on the verification page to activate your account.</p>
            <p><strong>⏰ This code will expire in 10 minutes.</strong></p>
            <p>If you didn't create an account with DG-CRM, please ignore this email.</p>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Discover Group. All rights reserved.</p>
              <p style="margin-top: 10px;">This is an automated message, please do not reply.</p>
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
      subject: `Your DG-CRM Verification Code: ${verificationCode}`,
      html: emailHtml
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Verification email sent successfully',
        success: true 
      })
    };

  } catch (error: any) {
    console.error('Error sending verification email:', error);
    
    const errorMessage = error?.response?.body?.errors 
      ? JSON.stringify(error.response.body.errors)
      : error?.message || 'Unknown error';
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to send verification email',
        details: errorMessage,
        success: false 
      })
    };
  }
};
