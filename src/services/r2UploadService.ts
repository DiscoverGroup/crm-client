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
 *
 * @param onProgress - Called with 0-100 as bytes are transferred to R2.
 * @param maxRetries - Number of full retry attempts (get new presigned URL + re-PUT) on failure.
 */
export async function uploadFileToR2(
  file: File,
  bucket: string,
  folder: string = '',
  onProgress?: (percent: number) => void,
  maxRetries: number = 3
): Promise<UploadResponse> {
  if (!file) return { success: false, error: 'No file selected' };

  let lastError = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Step 1: Get a fresh presigned PUT URL from the server
      const urlRes = await fetch(`${API_BASE}/get-upload-url`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, folder, bucket }),
      });

      if (!urlRes.ok) {
        const err = await urlRes.json().catch(() => ({})) as { error?: string };
        lastError = err.error || `Failed to get upload URL (${urlRes.status})`;
        // Auth / permission errors — don't retry
        if (urlRes.status === 401 || urlRes.status === 403) {
          return { success: false, error: lastError };
        }
        if (attempt < maxRetries) await _backoff(attempt);
        continue;
      }

      const { presignedUrl, path, url } = await urlRes.json() as {
        presignedUrl: string;
        path: string;
        url: string;
      };

      // Step 2: PUT the file directly to R2 using XHR so we can report progress.
      const uploadResult = await _xhrPut(presignedUrl, file, onProgress);

      if (!uploadResult.ok) {
        lastError = `Upload failed: ${uploadResult.status}`;
        if (attempt < maxRetries) await _backoff(attempt);
        continue;
      }

      return { success: true, path, url };
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown error';
      if (attempt < maxRetries) await _backoff(attempt);
    }
  }

  return { success: false, error: lastError };
}

/** PUT a file via XMLHttpRequest so we get upload progress events. */
function _xhrPut(
  url: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ ok: boolean; status: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.addEventListener('load', () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status }));
    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.send(file);
  });
}

/** Exponential backoff: 1s, 2s, 4s, … capped at 8s */
function _backoff(attempt: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, Math.min(1000 * 2 ** (attempt - 1), 8000)));
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
