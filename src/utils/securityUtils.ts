/**
 * Browser-Safe Security Utilities
 * Client-side validation and sanitization functions
 * For Node.js-specific functions (crypto, tokens), use netlify/functions/utils/securityUtils.ts
 */

// ============================================
// 1. INPUT VALIDATION
// ============================================

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email.trim()) && email.length <= 254;
}

/**
 * Validates password strength
 * - Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
 */
export function isValidPassword(password: string): boolean {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return typeof password === 'string' && passwordRegex.test(password);
}

/**
 * Validates username format
 * - 3-30 chars, alphanumeric, underscore, hyphen only
 */
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
  return typeof username === 'string' && usernameRegex.test(username.trim());
}

/**
 * Validates MongoDB ObjectId format
 */
export function isValidObjectId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

/**
 * Validates generic string ID
 * - Prevents NoSQL injection by checking format
 */
export function isValidStringId(id: string, maxLength: number = 100): boolean {
  if (typeof id !== 'string') return false;
  if (id.length === 0 || id.length > maxLength) return false;
  // Allow alphanumeric, underscore, hyphen, dot only (no special chars)
  return /^[a-zA-Z0-9_.\-]+$/.test(id);
}

/**
 * Validates message content
 * - Prevents extremely long messages, null bytes, etc.
 */
export function isValidMessageContent(content: string, maxLength: number = 10000): boolean {
  if (typeof content !== 'string') return false;
  if (content.length === 0 || content.length > maxLength) return false;
  // Reject null bytes and other control characters
  return !content.includes('\0') && !content.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/);
}

/**
 * Validates file upload
 * - Checks size and file extension
 */
export function isValidFileUpload(
  file: { name: string; size: number },
  allowedExtensions: string[] = ['pdf', 'doc', 'docx', 'txt', 'jpg', 'png', 'gif'],
  maxSizeMB: number = 50
): { valid: boolean; error?: string } {
  if (!file || !file.name || typeof file.size !== 'number') {
    return { valid: false, error: 'Invalid file object' };
  }

  // Check file size
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` };
  }

  // Check file extension
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !allowedExtensions.includes(extension)) {
    return { valid: false, error: `File type not allowed. Allowed: ${allowedExtensions.join(', ')}` };
  }

  return { valid: true };
}



// ============================================
// 2. SANITIZATION
// ============================================

/**
 * Sanitizes user input to prevent XSS
 * Removes HTML tags and dangerous characters
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Escape HTML special characters
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '');
}

/**
 * Sanitizes email (basic cleanup)
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Sanitizes filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== 'string') return '';
  
  return filename
    .trim()
    .replace(/\0/g, '')
    // Remove path traversal attempts
    .replace(/\.\.\//g, '')
    .replace(/\.\.\\/g, '')
    // Remove directory separators
    .replace(/[\/\\]/g, '_')
    // Keep only safe characters
    .replace(/[^a-zA-Z0-9._\-]/g, '_');
}

// ============================================
// 3. HEADERS (Client-side)
// ============================================

/**
 * Returns security headers for client requests
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  };
}

/**
 * Returns CORS-friendly headers
 */
export function getCORSHeaders(): Record<string, string> {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
}

// ============================================
// 4. DATA EXTRACTION (for logging)
// ============================================

/**
 * Safely extracts user info for logging (without sensitive data)
 */
export function getSafeUserInfo(user: any): Record<string, any> {
  return {
    id: user?.id,
    email: user?.email?.substring(0, 3) + '***',
    username: user?.username,
    role: user?.role
  };
}

/**
 * Masks sensitive data in logs
 */
export function maskSensitiveData(data: string): string {
  // Mask email addresses
  let masked = data.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***');
  
  // Mask phone numbers
  masked = masked.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '***-***-****');
  
  // Mask credit card numbers
  masked = masked.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '****-****-****-****');
  
  return masked;
}

// ============================================
// 5. VALIDATION HELPERS FOR COMMON PATTERNS
// ============================================

/**
 * Validates user registration input
 */
export function validateUserRegistration(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isValidEmail(data.email)) {
    errors.push('Invalid email format');
  }
  if (!isValidPassword(data.password)) {
    errors.push('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
  }
  if (!isValidUsername(data.username)) {
    errors.push('Username must be 3-30 characters, alphanumeric with underscore/hyphen');
  }
  if (typeof data.fullName !== 'string' || data.fullName.length === 0) {
    errors.push('Full name is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates user login input
 */
export function validateUserLogin(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.email || typeof data.email !== 'string') {
    errors.push('Email is required');
  }
  if (!data.password || typeof data.password !== 'string') {
    errors.push('Password is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates message input
 */
export function validateMessage(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isValidStringId(data.fromUserId)) {
    errors.push('Invalid sender ID');
  }
  if (!isValidMessageContent(data.content)) {
    errors.push('Message content invalid or too long (max 10000 chars)');
  }
  if (data.toUserId && !isValidStringId(data.toUserId)) {
    errors.push('Invalid recipient ID');
  }
  if (data.groupId && !isValidStringId(data.groupId)) {
    errors.push('Invalid group ID');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
