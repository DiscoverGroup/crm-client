import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';

export const handler: Handler = async (event) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
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
    const { email, password } = JSON.parse(event.body || '{}');

    if (!email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Email and password are required' 
        })
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
      const usersCollection = db.collection('users');

      // Find user by email or username
      const user = await usersCollection.findOne({
        $or: [
          { email: email.trim() },
          { username: email.trim() }
        ]
      });

      if (!user) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Invalid email/username or password' 
          })
        };
      }

      // Check password (in production, you should hash passwords!)
      if (user.password !== password.trim()) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Invalid email/username or password' 
          })
        };
      }

      // Check if email is verified
      if (user.isVerified === false) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Email not verified',
            needsVerification: true
          })
        };
      }

      // Return user data (without password)
      const userData = {
        id: user._id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        department: user.department,
        position: user.position,
        profileImage: user.profileImage,
        isVerified: user.isVerified
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          user: userData,
          message: 'Login successful'
        })
      };

    } finally {
      await client.close();
    }

  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Server error during login' 
      })
    };
  }
};
