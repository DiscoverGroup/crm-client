import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, r2PublicUrl } from '../config/r2';

interface UploadResponse {
  success: boolean;
  path?: string;
  url?: string;
  error?: string;
}

/**
 * Upload a file to Cloudflare R2
 * @param file - The file to upload
 * @param bucket - The R2 bucket name
 * @param folder - Optional folder path within the bucket
 * @returns Upload response with path and URL or error
 */
export async function uploadFileToR2(
  file: File,
  bucket: string,
  folder: string = ''
): Promise<UploadResponse> {
  try {
    if (!file) {
      return { success: false, error: 'No file selected' };
    }

    // Create a unique filename
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    // Upload the file (File objects can be used directly as Body)
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: filePath,
      Body: file as any,
      ContentType: file.type,
    });

    await r2Client.send(command);

    // Construct the public URL
    const publicUrl = `${r2PublicUrl}/${filePath}`;

    return {
      success: true,
      path: filePath,
      url: publicUrl,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Delete a file from Cloudflare R2
 * @param bucket - The R2 bucket name
 * @param filePath - The file path to delete
 * @returns Success or error response
 */
export async function deleteFileFromR2(
  bucket: string,
  filePath: string
): Promise<UploadResponse> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: filePath,
    });

    await r2Client.send(command);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Get the public URL for a file
 * @param filePath - The file path
 * @returns The public URL
 */
export function getR2FileUrl(filePath: string): string {
  return `${r2PublicUrl}/${filePath}`;
}
