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
    const archive = archiver('zip', { zlib: { level: 0 } }); // level 0 = no compression (fastest — files are mostly already-compressed PDFs/images)
    const chunks: Buffer[] = [];
    let archiveComplete = false;
    let archiveError: Error | null = null;

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => { archiveComplete = true; });
    archive.on('error', (err: Error) => { archiveError = err; archiveComplete = true; });

    // Download files in parallel batches of 15 (much faster than one-by-one)
    const BATCH_SIZE = 15;
    let done = 0;

    for (let batchStart = 0; batchStart < uploadedFiles.length; batchStart += BATCH_SIZE) {
      const batch = uploadedFiles.slice(batchStart, batchStart + BATCH_SIZE);
      
      // Download all files in this batch simultaneously
      const results = await Promise.allSettled(
        batch.map(async (obj) => {
          const res = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: obj.Key }));
          if (!res.Body) return null;
          const fileChunks: Buffer[] = [];
          for await (const chunk of res.Body as Readable) {
            fileChunks.push(Buffer.from(chunk));
          }
          return { key: obj.Key, buffer: Buffer.concat(fileChunks) };
        })
      );

      // Add successfully downloaded files to ZIP (in order)
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          archive.append(result.value.buffer, { name: result.value.key });
        } else if (result.status === 'rejected') {
          console.error(`Skipping file:`, result.reason);
        }
      }

      done += batch.length;
      await writeZipStatus(dateLabel, { state: 'running', done, total, phase: 'zipping' });
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
