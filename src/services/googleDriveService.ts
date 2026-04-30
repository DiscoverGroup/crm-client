import { authHeaders } from '../utils/authToken';
import type { FileAttachment } from './fileService';

export interface DriveBackupResult {
  copied: number;
  failed: number;
  errors: string[];
}

export interface DriveProgress {
  current: number;
  total: number;
  currentFile: string;
}

/** Upload a single file blob to Google Drive via multipart upload. */
async function uploadToDrive(
  blob: Blob,
  filename: string,
  mimeType: string,
  folderId: string,
  accessToken: string,
  uploadApi: string
): Promise<void> {
  const metadata = JSON.stringify({ name: filename, parents: [folderId] });
  const boundary = '---CRMDriveBoundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metaPart = `${delimiter}Content-Type: application/json\r\n\r\n${metadata}`;
  const filePart = `${delimiter}Content-Type: ${mimeType}\r\n\r\n`;

  // Build multipart body
  const enc = new TextEncoder();
  const metaBytes = enc.encode(metaPart);
  const filePartBytes = enc.encode(filePart);
  const closeBytes = enc.encode(closeDelimiter);
  const fileBytes = new Uint8Array(await blob.arrayBuffer());

  const body = new Uint8Array(metaBytes.length + filePartBytes.length + fileBytes.length + closeBytes.length);
  body.set(metaBytes, 0);
  body.set(filePartBytes, metaBytes.length);
  body.set(fileBytes, metaBytes.length + filePartBytes.length);
  body.set(closeBytes, metaBytes.length + filePartBytes.length + fileBytes.length);

  const res = await fetch(`${uploadApi}/files?uploadType=multipart&supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive upload failed (${res.status}): ${text}`);
  }
}

/** Get a signed download URL for an R2 file via Netlify function. */
async function getR2DownloadUrl(r2Path: string): Promise<string> {
  const res = await fetch(
    `/.netlify/functions/download-file?` + new URLSearchParams({ path: r2Path }),
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error(`Failed to get download URL for ${r2Path}`);
  const { url } = await res.json();
  return url;
}

/**
 * Back up a list of file attachments to Google Drive.
 * clientName is used to get/create the Drive subfolder.
 */
export async function backupFilesToDrive(
  attachments: FileAttachment[],
  clientName: string,
  onProgress?: (p: DriveProgress) => void,
  routeName?: string
): Promise<DriveBackupResult> {
  // Get Drive token + folder from Netlify function
  const tokenRes = await fetch('/.netlify/functions/get-drive-token', {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientName, routeName }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({ error: 'Failed to connect to Google Drive' }));
    throw new Error(err.error || 'Failed to get Drive token');
  }

  const { accessToken, folderId, uploadApi } = await tokenRes.json();

  const r2Files = attachments.filter(a => a.file.isR2 && a.file.r2Path);
  const total = r2Files.length;
  let copied = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < r2Files.length; i++) {
    const att = r2Files[i];
    onProgress?.({ current: i + 1, total, currentFile: att.file.name });

    try {
      // Download from R2
      const signedUrl = await getR2DownloadUrl(att.file.r2Path!);
      const fileRes = await fetch(signedUrl);
      if (!fileRes.ok) throw new Error(`R2 download failed (${fileRes.status})`);
      const blob = await fileRes.blob();

      // Upload to Drive
      await uploadToDrive(blob, att.file.name, att.file.type || 'application/octet-stream', folderId, accessToken, uploadApi);
      copied++;
    } catch (err: any) {
      failed++;
      errors.push(`${att.file.name}: ${err.message}`);
    }
  }

  return { copied, failed, errors };
}
