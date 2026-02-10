import type { Handler } from '@netlify/functions';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get file path from query parameter
    const filePath = event.queryStringParameters?.path;

    if (!filePath) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing file path parameter' })
      };
    }

    // Check credentials
    if (!accountId || !accessKeyId || !secretAccessKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'R2 credentials not configured' })
      };
    }

    // Generate a signed URL (valid for 7 days - maximum allowed)
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: filePath,
    });

    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 604800 });

    // Return the signed URL
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
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
        error: error.message || 'Failed to generate download URL' 
      })
    };
  }
};
