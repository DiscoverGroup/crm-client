/**
 * r2UploadService — browser-side file upload/delete client
 *
 * Security: credentials are NEVER exposed to the browser.
 * All operations go through authenticated Netlify functions:
 *   POST /.netlify/functions/get-upload-url  → returns a short-lived presigned PUT URL
 *   POST /.netlify/functions/delete-file     → deletes a file server-side
 *
 * The browser then PUTs the file directly to MinIO using the presigned URL,
 * so large files never pass through a function's 6 MB payload limit.
 */

import { authHeaders } from '../utils/authToken';

const API_BASE = '/.netlify/functions';

interface UploadResponse {
  success: boolean;
  path?: string;
  url?: string;
  error?: string;
}

function getPublicBaseUrl(): string {
  let base = import.meta.env.VITE_R2_PUBLIC_URL || '';
  if (base.endsWith('/')) base = base.slice(0, -1);
  return base;
}

/**
 * Upload a file via the server-side presigned URL flow.
 * Credentials never leave the server.
 */
export async function uploadFileToR2(
  file: File,
  bucket: string,
  folder: string = ''
): Promise<UploadResponse> {
  try {
    if (!file) return { success: false, error: 'No file selected' };

    // Step 1: Ask the server for a short-lived presigned PUT URL
    const urlRes = await fetch(`${API_BASE}/get-upload-url`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, contentType: file.type, folder, bucket }),
    });

    if (!urlRes.ok) {
      const err = await urlRes.json().catch(() => ({})) as { error?: string };
      return { success: false, error: err.error || `Failed to get upload URL (${urlRes.status})` };
    }

    const { presignedUrl, path, url } = await urlRes.json() as {
      presignedUrl: string;
      path: string;
      url: string;
    };

    // Step 2: PUT the file directly to MinIO — no credentials in this request,
    //         the presigned URL signature acts as a time-limited capability token.
    const uploadRes = await fetch(presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });

    if (!uploadRes.ok) {
      return { success: false, error: `Upload failed: ${uploadRes.status} ${uploadRes.statusText}` };
    }

    return { success: true, path, url };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Delete a file via the authenticated server-side function.
 */
export async function deleteFileFromR2(
  bucket: string,
  filePath: string
): Promise<UploadResponse> {
  try {
    const res = await fetch(`${API_BASE}/delete-file`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket, filePath }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      return { success: false, error: err.error || `Delete failed (${res.status})` };
    }

    const result = await res.json() as { success: boolean };
    return { success: result.success };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Build the public download URL for an existing stored file path.
 * Only the base URL is needed (VITE_R2_PUBLIC_URL) — no credentials required.
 */
export function getR2FileUrl(filePath: string): string {
  return `${getPublicBaseUrl()}/${filePath}`;
}
