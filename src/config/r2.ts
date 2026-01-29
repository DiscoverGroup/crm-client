import { S3Client } from '@aws-sdk/client-s3';

const accountId = import.meta.env.VITE_R2_ACCOUNT_ID || '';
const accessKeyId = import.meta.env.VITE_R2_ACCESS_KEY_ID || '';
const secretAccessKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY || '';

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.warn('Cloudflare R2 credentials are not configured. File uploads will not work.');
}

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export const r2PublicUrl = `https://${import.meta.env.VITE_R2_BUCKET_NAME || 'your-bucket'}.${accountId}.r2.cloudflarestorage.com`;
