import type { Handler } from '@netlify/functions';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';

const accountId = process.env.VITE_R2_ACCOUNT_ID || '';
const accessKeyId = process.env.VITE_R2_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.VITE_R2_SECRET_ACCESS_KEY || '';
const bucket = process.env.VITE_R2_BUCKET_NAME || 'crm-uploads';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export const handler: Handler = async (event) => {
  const headers = {
    ...getCORSHeaders(process.env.ALLOWED_ORIGIN),
    ...getSecurityHeaders(),
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // ── JWT Authentication ─────────────────────────────────────────────────────
  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) {
    return unauthorizedResponse(headers, auth.error);
  }

  try {
    // Get file path from query parameter
    const filePath = event.queryStringParameters?.path;

    if (!filePath) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing file path parameter' })
      };
    }

    // ── Ownership check — prevent IDOR (Insecure Direct Object Reference) ──────
    // File paths must start with the requesting user's ID so users can only
    // access their own files. Admins may access any path.
    const requestingUserId = auth.user!.userId;
    const requestingRole   = auth.user!.role;
    if (requestingRole !== 'admin' && !filePath.startsWith(requestingUserId + '/')) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Access denied: you do not own this file' })
      };
    }

    // Check credentials
    if (!accountId || !accessKeyId || !secretAccessKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'R2 credentials not configured' })
      };
    }

    // Generate a signed URL (valid for 1 hour — reduced from 7 days)
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: filePath,
    });

    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });

    // Return the signed URL
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        url: signedUrl 
      })
    };
  } catch (error: any) {
    // console.error('Error generating signed URL:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        error: 'Failed to generate download URL' 
      })
    };
  }
};
