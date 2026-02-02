import type { Handler } from '@netlify/functions';
import sgMail from '@sendgrid/mail';

// Initialize SendGrid with environment variable
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const SENDGRID_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_ID || 'd-29e2da710fbf423b90cc3bb343edcfbe';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply.discovergrp@gmail.com';

sgMail.setApiKey(SENDGRID_API_KEY);

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
    const resetUrl = `https://dg-crm-client.netlify.app/reset-password?token=${resetToken}`;
    const expirationTime = 30; // minutes

    // Send email using SendGrid Dynamic Template
    const msg = {
      to: email,
      from: FROM_EMAIL,
      templateId: SENDGRID_TEMPLATE_ID,
      dynamicTemplateData: {
        fullName: user.fullName || user.username,
        resetUrl: resetUrl,
        expirationTime: expirationTime
      }
    };

    await sgMail.send(msg);

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
