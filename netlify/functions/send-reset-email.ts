import type { Handler } from '@netlify/functions';
import sgMail from '@sendgrid/mail';

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { email } = JSON.parse(event.body || '{}');

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    // Find user by email (you'll need to adapt this to your storage)
    // For now, we'll use localStorage structure, but in production you'd query a database
    const users = JSON.parse(process.env.CRM_USERS || '[]');
    const user = users.find((u: any) => u.email === email);

    if (!user) {
      // Don't reveal if user exists or not for security
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'If the email exists, a reset link has been sent' })
      };
    }

    // Generate reset token (in production, save this to database with expiration)
    const resetToken = generateResetToken();
    const resetUrl = `${process.env.URL}/reset-password?token=${resetToken}`;
    const expirationTime = 30; // minutes

    // Send email using SendGrid Dynamic Template
    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@discovergrp.com',
      templateId: process.env.SENDGRID_RESET_TEMPLATE_ID || '', // Your template ID
      dynamicTemplateData: {
        fullName: user.fullName,
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

  } catch (error) {
    console.error('Error sending reset email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to send reset email',
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
