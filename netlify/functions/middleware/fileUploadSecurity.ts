/**
 * File Upload Security Service
 * Implements protection against malicious file uploads
 * - File type validation
 * - Size limits
 * - Filename sanitization
 * - Magic number verification
 */

// ============================================
// FILE TYPE DEFINITIONS
// ============================================

interface FileTypeDefinition {
  mimeTypes: string[];
  extensions: string[];
  maxSize: number; // in bytes
  magicNumbers?: Buffer[];
}

/**
 * Safe file types allowed for upload
 */
export const SAFE_FILE_TYPES: Record<string, FileTypeDefinition> = {
  PDF: {
    mimeTypes: ['application/pdf'],
    extensions: ['pdf'],
    maxSize: 50 * 1024 * 1024, // 50 MB
    magicNumbers: [Buffer.from([0x25, 0x50, 0x44, 0x46])] // %PDF
  },
  
  IMAGE_JPEG: {
    mimeTypes: ['image/jpeg'],
    extensions: ['jpg', 'jpeg'],
    maxSize: 10 * 1024 * 1024, // 10 MB
    magicNumbers: [Buffer.from([0xFF, 0xD8, 0xFF])] // JPEG magic bytes
  },
  
  IMAGE_PNG: {
    mimeTypes: ['image/png'],
    extensions: ['png'],
    maxSize: 10 * 1024 * 1024, // 10 MB
    magicNumbers: [Buffer.from([0x89, 0x50, 0x4E, 0x47])] // PNG magic bytes
  },
  
  IMAGE_GIF: {
    mimeTypes: ['image/gif'],
    extensions: ['gif'],
    maxSize: 10 * 1024 * 1024, // 10 MB
    magicNumbers: [Buffer.from([0x47, 0x49, 0x46])] // GIF magic bytes
  },
  
  DOCUMENT_WORD: {
    mimeTypes: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    extensions: ['doc', 'docx'],
    maxSize: 25 * 1024 * 1024, // 25 MB
    magicNumbers: [
      Buffer.from([0xD0, 0xCF, 0x11, 0xE0]), // DOC
      Buffer.from([0x50, 0x4B, 0x03, 0x04]) // DOCX (ZIP)
    ]
  },
  
  DOCUMENT_EXCEL: {
    mimeTypes: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    extensions: ['xls', 'xlsx'],
    maxSize: 25 * 1024 * 1024, // 25 MB
    magicNumbers: [
      Buffer.from([0xD0, 0xCF, 0x11, 0xE0]), // XLS
      Buffer.from([0x50, 0x4B, 0x03, 0x04]) // XLSX (ZIP)
    ]
  },
  
  TEXT_PLAIN: {
    mimeTypes: ['text/plain'],
    extensions: ['txt'],
    maxSize: 5 * 1024 * 1024, // 5 MB
    magicNumbers: [] // No magic bytes check for text
  }
};

// ============================================
// FILE VALIDATION
// ============================================

/**
 * Validates file upload
 */
export function validateFileUpload(
  file: {
    name: string;
    size: number;
    mimeType?: string;
    buffer?: Buffer;
  },
  allowedTypes: string[] = ['PDF', 'IMAGE_JPEG', 'IMAGE_PNG', 'DOCUMENT_WORD', 'DOCUMENT_EXCEL', 'TEXT_PLAIN']
): { valid: boolean; error?: string } {
  // Check file exists
  if (!file || !file.name || file.size === undefined) {
    return { valid: false, error: 'Invalid file object' };
  }

  // Check filename
  const filenameValidation = validateFilename(file.name);
  if (!filenameValidation.valid) {
    return filenameValidation;
  }

  // Check file size
  const extension = getFileExtension(file.name).toUpperCase();
  
  for (const typeName of allowedTypes) {
    const typeDef = SAFE_FILE_TYPES[typeName];
    
    if (typeDef.extensions.includes(extension.toLowerCase())) {
      // Check file size against type limit
      if (file.size > typeDef.maxSize) {
        return {
          valid: false,
          error: `File size exceeds ${formatFileSize(typeDef.maxSize)} limit for ${extension} files`
        };
      }

      // Check MIME type if provided
      if (file.mimeType && !typeDef.mimeTypes.includes(file.mimeType.toLowerCase())) {
        return { valid: false, error: `Invalid MIME type for ${extension} file` };
      }

      // Check magic numbers if buffer provided
      if (file.buffer && typeDef.magicNumbers && typeDef.magicNumbers.length > 0) {
        const magicValid = typeDef.magicNumbers.some(magic =>
          file.buffer!.toString('hex').startsWith(magic.toString('hex'))
        );

        if (!magicValid) {
          return { valid: false, error: `File content doesn't match ${extension} format` };
        }
      }

      return { valid: true };
    }
  }

  return { valid: false, error: `File type ${extension} is not allowed` };
}

/**
 * Validates filename
 * - No path traversal
 * - No executable extensions
 * - Safe characters only
 */
export function validateFilename(filename: string): { valid: boolean; error?: string } {
  if (!filename || typeof filename !== 'string') {
    return { valid: false, error: 'Filename is required' };
  }

  // Check length
  if (filename.length > 255) {
    return { valid: false, error: 'Filename is too long (max 255 characters)' };
  }

  // Prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return { valid: false, error: 'Filename contains invalid characters' };
  }

  // Check for executable extensions
  const dangerousExtensions = [
    'exe', 'bat', 'cmd', 'scr', 'vbs', 'js', 'jar', 'zip', 'rar', 'sh', 'app', 'deb',
    'dmg', 'msi', 'msp', 'com', 'pif', 'src', 'ps1', 'psd1', 'psm1'
  ];
  
  const extension = getFileExtension(filename).toLowerCase();
  if (dangerousExtensions.includes(extension)) {
    return { valid: false, error: `File type .${extension} is not allowed` };
  }

  // Check for null bytes and control characters
  if (filename.includes('\0') || /[\x00-\x1F]/.test(filename)) {
    return { valid: false, error: 'Filename contains invalid characters' };
  }

  return { valid: true };
}

/**
 * Gets file extension
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

/**
 * Sanitizes filename for storage
 */
export function sanitizeStorageFilename(filename: string): string {
  if (!filename) return 'file';

  // Remove path traversal
  const sanitized = filename
    .replace(/\.\.\//g, '')
    .replace(/\.\.\\/g, '')
    .replace(/[\/\\]/g, '_')
    // Remove all but alphanumeric, dot, dash, underscore
    .replace(/[^a-zA-Z0-9._\-]/g, '_')
    // Prevent double dots
    .replace(/\.{2,}/g, '.');

  return sanitized || 'file';
}

// ============================================
// VIRUS SCANNING PREPARATION
// ============================================

/**
 * Checks if file should be scanned (high-risk types)
 */
export function shouldScanForVirus(filename: string): boolean {
  const highRiskExtensions = ['exe', 'zip', 'rar', 'doc', 'xls', 'ppt'];
  const extension = getFileExtension(filename).toLowerCase();
  return highRiskExtensions.includes(extension);
}

/**
 * Prepares file for virus scanning
 * Returns metadata and hash for external scanning service
 */
export function prepareForVirusScan(
  filename: string,
  fileHash: string,
  fileSize: number
): {
  filename: string;
  hash: string;
  size: number;
  needsScan: boolean;
  scanType: string;
} {
  return {
    filename: sanitizeStorageFilename(filename),
    hash: fileHash,
    size: fileSize,
    needsScan: shouldScanForVirus(filename),
    scanType: fileSize > 100 * 1024 * 1024 ? 'async' : 'sync' // Large files async
  };
}

// ============================================
// FILE SIZE HELPERS
// ============================================

/**
 * Formats file size for display
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Parses file size string to bytes
 */
export function parseFileSize(sizeStr: string): number {
  const units: Record<string, number> = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024
  };

  const match = sizeStr.match(/^([\d.]+)\s*(B|KB|MB|GB)$/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  return value * (units[unit] || 1);
}

// ============================================
// UPLOAD RESPONSE HELPER
// ============================================

/**
 * Creates error response for invalid file
 */
export function getFileValidationErrorResponse(
  validation: ReturnType<typeof validateFileUpload>,
  corsOrigin?: string
): any {
  return {
    statusCode: 400,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': corsOrigin || '*'
    },
    body: JSON.stringify({
      success: false,
      error: validation.error || 'File validation failed'
    })
  };
}

/**
 * Checks if uploaded file matches declared type
 * Verifies magic numbers to prevent type mismatch attacks
 */
export function verifyMagicNumbers(
  buffer: Buffer,
  declaredType: string
): boolean {
  const typeDef = SAFE_FILE_TYPES[declaredType];
  if (!typeDef || !typeDef.magicNumbers || typeDef.magicNumbers.length === 0) {
    return true; // Skip check if no magic numbers defined
  }

  const fileHex = buffer.toString('hex');
  
  return typeDef.magicNumbers.some(magic =>
    fileHex.startsWith(magic.toString('hex'))
  );
}
