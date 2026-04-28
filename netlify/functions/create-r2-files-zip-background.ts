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

async function writeZipStatus(dateLabel: string, status: object): Promise<void> {
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `backups/${dateLabel}/zip-status.json`,
      Body: JSON.stringify(status),
      ContentType: 'application/json',
    }));
  } catch (err) {
    console.error('Failed to write zip-status.json:', err);
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: { ...getSecurityHeaders(), 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
      body: '',
    };
  }

  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid || auth.user?.role !== 'admin') {
    return {
      statusCode: 403,
      headers: { ...getSecurityHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized — admin access required' }),
    };
  }

  createZipBackup().catch(err => {
    console.error('Background ZIP creation failed:', err);
  });

  return {
    statusCode: 202,
    headers: { ...getSecurityHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ accepted: true }),
  };
};

async function createZipBackup(): Promise<void> {
  const dateLabel = new Date().toISOString().slice(0, 10);
  const zipKey = `backups/${dateLabel}/all-files.zip`;

  // Write initial status
  await writeZipStatus(dateLabel, { state: 'running', done: 0, total: 0, phase: 'listing' });

  try {
    // List all files (paginate in case > 1000)
    const uploadedFiles: Array<{ Key: string; Size: number }> = [];
    let continuationToken: string | undefined;
    do {
      const listRes = await s3Client.send(new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: '',
        ContinuationToken: continuationToken,
      }));
      for (const obj of listRes.Contents || []) {
        if (obj.Key && !obj.Key.startsWith('backups/') && (obj.Size ?? 0) > 0) {
          uploadedFiles.push({ Key: obj.Key, Size: obj.Size! });
        }
      }
      continuationToken = listRes.NextContinuationToken;
    } while (continuationToken);

    if (uploadedFiles.length === 0) {
      await writeZipStatus(dateLabel, { state: 'error', error: 'No files found in R2 to archive' });
      return;
    }

    const total = uploadedFiles.length;
    await writeZipStatus(dateLabel, { state: 'running', done: 0, total, phase: 'zipping' });

    // Create ZIP in memory
    const archive = archiver('zip', { zlib: { level: 1 } }); // level 1 = fast, less memory
    const chunks: Buffer[] = [];
    let archiveComplete = false;
    let archiveError: Error | null = null;

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => { archiveComplete = true; });
    archive.on('error', (err: Error) => { archiveError = err; archiveComplete = true; });

    // Download each file and add to ZIP
    for (let i = 0; i < uploadedFiles.length; i++) {
      const obj = uploadedFiles[i];
      try {
        const res = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: obj.Key }));
        if (res.Body) {
          const fileChunks: Buffer[] = [];
          for await (const chunk of res.Body as Readable) {
            fileChunks.push(Buffer.from(chunk));
          }
          archive.append(Buffer.concat(fileChunks), { name: obj.Key });
        }
      } catch (err) {
        console.error(`Skipping ${obj.Key}:`, err);
      }

      // Update status every 10 files
      if ((i + 1) % 10 === 0 || i === uploadedFiles.length - 1) {
        await writeZipStatus(dateLabel, { state: 'running', done: i + 1, total, phase: 'zipping' });
      }
    }

    await archive.finalize();
    while (!archiveComplete) {
      await new Promise(r => setTimeout(r, 100));
    }
    if (archiveError) throw archiveError;

    const zipBuffer = Buffer.concat(chunks);

    await writeZipStatus(dateLabel, { state: 'running', done: total, total, phase: 'uploading' });

    // Upload ZIP to R2
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: zipKey,
      Body: zipBuffer,
      ContentType: 'application/zip',
    }));

    await writeZipStatus(dateLabel, { state: 'complete', done: total, total, sizeBytes: zipBuffer.length });
    console.log(`ZIP uploaded: ${zipKey} (${zipBuffer.length} bytes)`);

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await writeZipStatus(dateLabel, { state: 'error', error: msg });
    console.error('ZIP creation failed:', error);
    throw error;
  }
}


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
