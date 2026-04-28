import { Handler } from '@netlify/functions';
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { verifyAuthToken } from './middleware/authMiddleware';
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

/**
 * Background function that creates a ZIP of all R2 files and saves it to R2.
 * Returns 202 immediately, then creates the ZIP in the background.
 */
export const handler: Handler = async (event) => {
  // CORS headers
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: { ...getSecurityHeaders(), 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
      body: '',
    };
  }

  // Auth check
  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid || auth.user?.role !== 'admin') {
    return {
      statusCode: 403,
      headers: { ...getSecurityHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized — admin access required' }),
    };
  }

  // Fire and forget the background work
  createZipBackup().catch(err => {
    console.error('Background ZIP creation failed:', err);
  });

  // Return 202 immediately
  return {
    statusCode: 202,
    headers: { ...getSecurityHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      accepted: true, 
      message: 'Creating ZIP archive in background. Check R2 Backup Files section for the download link.' 
    }),
  };
};

async function createZipBackup(): Promise<void> {
  const dateLabel = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const zipKey = `backups/${dateLabel}/all-files.zip`;

  try {
    // List all files in R2 (excluding backups/ folder)
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: '',
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
      console.log('No files to ZIP');
      return;
    }

    console.log(`Creating ZIP with ${uploadedFiles.length} files`);

    // Create ZIP archive in memory
    const archive = archiver('zip', { zlib: { level: 6 } });
    const chunks: Buffer[] = [];
    
    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    let archiveComplete = false;
    let archiveError: Error | null = null;

    archive.on('end', () => {
      archiveComplete = true;
    });

    archive.on('error', (err: Error) => {
      archiveError = err;
      archiveComplete = true;
    });

    // Download each file from R2 and add to ZIP
    for (const obj of uploadedFiles) {
      if (!obj.Key) continue;

      try {
        const getCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: obj.Key,
        });

        const response = await s3Client.send(getCommand);
        
        if (response.Body) {
          const stream = response.Body as Readable;
          const fileChunks: Buffer[] = [];
          
          for await (const chunk of stream) {
            fileChunks.push(Buffer.from(chunk));
          }
          
          const fileBuffer = Buffer.concat(fileChunks);
          archive.append(fileBuffer, { name: obj.Key });
        }
      } catch (err) {
        console.error(`Failed to add ${obj.Key} to ZIP:`, err);
        // Continue with other files
      }
    }

    // Finalize the archive
    await archive.finalize();

    // Wait for archive to complete
    while (!archiveComplete) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (archiveError) {
      throw archiveError;
    }

    const zipBuffer = Buffer.concat(chunks);
    console.log(`ZIP created: ${zipBuffer.length} bytes`);

    // Upload ZIP to R2
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: zipKey,
      Body: zipBuffer,
      ContentType: 'application/zip',
    });

    await s3Client.send(putCommand);
    console.log(`ZIP uploaded to ${zipKey}`);

  } catch (error) {
    console.error('ZIP creation failed:', error);
    throw error;
  }
}
