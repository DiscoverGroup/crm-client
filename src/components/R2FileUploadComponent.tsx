import React, { useState } from 'react';
import { uploadFileToR2, deleteFileFromR2 } from '../services/r2UploadService';

interface R2FileUploadProps {
  bucket: string;
  folder?: string;
  onUploadSuccess?: (path: string, url: string) => void;
  onUploadError?: (error: string) => void;
  accept?: string;
  maxSize?: number; // in bytes
  label?: string;
}

interface UploadedFile {
  name: string;
  path: string;
  url: string;
}

export const R2FileUploadComponent: React.FC<R2FileUploadProps> = ({
  bucket,
  folder = '',
  onUploadSuccess,
  onUploadError,
  accept = '*',
  maxSize = 100 * 1024 * 1024, // 100MB default for R2
  label = 'Upload File to R2',
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setErrorMessage('');
    setIsLoading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file size
        if (file.size > maxSize) {
          throw new Error(
            `File "${file.name}" is too large. Maximum size is ${(maxSize / 1024 / 1024).toFixed(2)}MB`
          );
        }

        // Upload file
        const result = await uploadFileToR2(file, bucket, folder);

        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }

        const uploadedFile: UploadedFile = {
          name: file.name,
          path: result.path || '',
          url: result.url || '',
        };

        setUploadedFiles((prev) => [...prev, uploadedFile]);

        if (onUploadSuccess && result.path && result.url) {
          onUploadSuccess(result.path, result.url);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(errorMsg);
      if (onUploadError) {
        onUploadError(errorMsg);
      }
    } finally {
      setIsLoading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleDeleteFile = async (index: number, filePath: string) => {
    setIsLoading(true);
    try {
      const result = await deleteFileFromR2(bucket, filePath);
      if (!result.success) {
        throw new Error(result.error || 'Delete failed');
      }
      setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="r2-upload-container p-4 border rounded-lg bg-gray-50">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
        <input
          type="file"
          multiple
          accept={accept}
          onChange={handleFileChange}
          disabled={isLoading}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-orange-50 file:text-orange-700
            hover:file:bg-orange-100
            disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="text-xs text-gray-500 mt-1">
          Maximum file size: {(maxSize / 1024 / 1024).toFixed(0)}MB
        </p>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {errorMessage}
        </div>
      )}

      {isLoading && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-700 text-sm">
          Uploading to R2...
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="uploaded-files">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Uploaded Files:</h3>
          <ul className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <li
                key={index}
                className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-md"
              >
                <div className="flex-1 min-w-0">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-600 hover:text-orange-800 text-sm truncate"
                  >
                    {file.name}
                  </a>
                </div>
                <button
                  onClick={() => handleDeleteFile(index, file.path)}
                  disabled={isLoading}
                  className="ml-2 px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 text-xs rounded disabled:opacity-50"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default R2FileUploadComponent;
