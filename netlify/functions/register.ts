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
    const { username, email, password, fullName, department, position, profileImage } = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!username || !email || !password || !fullName || !department || !position) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'All fields are required' 
        })
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Invalid email format' 
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
      const newUser = {
        username: username.trim(),
        email: email.trim(),
        password: password.trim(), // In production, hash this!
        fullName: fullName.trim(),
        department: department.trim(),
        position: position.trim(),
        profileImage: profileImage || '',
        isVerified: false, // Require email verification
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
