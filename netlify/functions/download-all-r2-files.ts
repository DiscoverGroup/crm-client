import { Handler } from '@netlify/functions';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders } from './utils/securityUtils';
import archiver from 'archiver';
import { Readable } from 'stream';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || '',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'crm-uploads';

export const handler: Handler = async (event) => {
  // CORS headers
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: { ...getSecurityHeaders(), 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
      body: '',
    };
  }

  // Auth check
  const auth = verifyAuthToken(event);
  if (!auth.valid || auth.user?.role !== 'admin') {
    return unauthorizedResponse();
  }

  try {
    // List all files in R2 (excluding backups/ folder)
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: '', // Root level - gets everything
    });

    const listResponse = await s3Client.send(listCommand);
    const allObjects = listResponse.Contents || [];

    // Filter out backup files (only get actual uploaded files)
    const uploadedFiles = allObjects.filter(obj => 
      obj.Key && 
      !obj.Key.startsWith('backups/') && 
      obj.Size && obj.Size > 0
    );

    if (uploadedFiles.length === 0) {
      return {
        statusCode: 200,
        headers: { ...getSecurityHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, message: 'No files found in R2', fileCount: 0 }),
      };
    }

    // Create a zip archive
    const archive = archiver('zip', { zlib: { level: 6 } });
    
    // Set up headers for streaming zip download
    const headers = {
      ...getSecurityHeaders(),
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="r2-files-backup-${new Date().toISOString().slice(0, 10)}.zip"`,
      'Transfer-Encoding': 'chunked',
    };

    // We need to return a streaming response
    // For Netlify Functions, we'll collect the zip in memory (works for moderate file counts)
    const chunks: Buffer[] = [];
    
    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    let archiveFinalized = false;
    archive.on('end', () => {
      archiveFinalized = true;
    });

    // Download each file from R2 and add to zip
    for (const obj of uploadedFiles) {
      if (!obj.Key) continue;

      try {
        const getCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: obj.Key,
        });

        const response = await s3Client.send(getCommand);
        
        if (response.Body) {
          // Convert stream to buffer
          const stream = response.Body as Readable;
          const fileChunks: Buffer[] = [];
          
          for await (const chunk of stream) {
            fileChunks.push(Buffer.from(chunk));
          }
          
          const fileBuffer = Buffer.concat(fileChunks);
          
          // Add file to zip with original path structure
          archive.append(fileBuffer, { name: obj.Key });
        }
      } catch (err) {
        console.error(`Failed to download ${obj.Key}:`, err);
        // Continue with other files
      }
    }

    // Finalize the archive
    await archive.finalize();

    // Wait for archive to finish
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (archiveFinalized) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);
    });

    const zipBuffer = Buffer.concat(chunks);

    return {
      statusCode: 200,
      headers,
      body: zipBuffer.toString('base64'),
      isBase64Encoded: true,
    };

  } catch (error) {
    console.error('Download all R2 files error:', error);
    return {
      statusCode: 500,
      headers: { ...getSecurityHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to download files' 
      }),
    };
  }
};
