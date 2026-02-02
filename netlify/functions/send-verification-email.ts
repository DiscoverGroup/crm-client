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
    const { email, fullName, verificationToken } = JSON.parse(event.body || '{}');

    if (!email || !fullName || !verificationToken) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    const verificationUrl = `https://dg-crm-client.netlify.app?verify=${verificationToken}&email=${encodeURIComponent(email)}`;

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
            <h1>✉️ Verify Your Email</h1>
          </div>
          <div class="content">
            <p>Hi ${fullName},</p>
            <p>Welcome to DG-CRM! To complete your registration, please verify your email address.</p>
            <p style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #1e7bb8;">${verificationUrl}</p>
            <p><strong>This link will expire in 24 hours.</strong></p>
            <p>If you didn't create an account with DG-CRM, please ignore this email.</p>
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
      subject: 'Verify Your Email - DG-CRM',
      html: emailHtml,
      text: `Hi ${fullName},\n\nWelcome to DG-CRM! Please verify your email address by clicking this link:\n\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you didn't create an account, please ignore this email.`
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
