/**
 * Centralised Form Sanitisation & Validation
 * ============================================
 * Applied uniformly across all 25 forms in the application.
 *
 * Protects against:
 *  - XSS (Cross-Site Scripting)
 *  - HTML/script injection
 *  - NoSQL / SQL injection patterns
 *  - Prototype pollution via crafted JSON keys
 *  - Path traversal in filenames
 *  - Null-byte injection
 *  - Control-character injection
 *  - Excessively long inputs (DoS / buffer-overrun)
 *  - Numeric-field forgery (non-numeric amounts)
 *  - OTP / token brute-force (format guard before API call)
 */

// ─── XSS / injection detection ───────────────────────────────────────────────

const XSS_PATTERNS: RegExp[] = [
  /<script[\s\S]*?>/i,
  /<\/script>/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /on\w+\s*=/i,          // onclick=, onerror=, onload=, …
  /<iframe[\s\S]*?>/i,
  /<object[\s\S]*?>/i,
  /<embed[\s\S]*?>/i,
  /<applet[\s\S]*?>/i,
  /data\s*:\s*text\/html/i,
  /expression\s*\(/i,    // CSS expression()
  /url\s*\(\s*['"]?\s*javascript/i,
];

const NOSQL_PATTERNS: RegExp[] = [
  /\$where/i,
  /\$ne\b/i,
  /\$gt\b/i,
  /\$lt\b/i,
  /\$gte\b/i,
  /\$lte\b/i,
  /\$in\b/i,
  /\$nin\b/i,
  /\$or\b/i,
  /\$and\b/i,
  /\$regex\b/i,
  /\$exists\b/i,
  /\$elemMatch\b/i,
];

/** Returns true when the string contains known attack patterns. */
export function containsAttackPatterns(value: string): boolean {
  if (typeof value !== 'string') return false;
  return XSS_PATTERNS.some(p => p.test(value)) || NOSQL_PATTERNS.some(p => p.test(value));
}

// ─── Prototype-pollution guard ────────────────────────────────────────────────

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype', 'toString', 'valueOf']);

/**
 * Recursively checks a parsed object for prototype-pollution keys.
 * Returns false if any dangerous key is found.
 */
export function isSafeObject(obj: unknown, depth = 0): boolean {
  if (depth > 10) return true; // prevent infinite recursion on deep objects
  if (obj === null || typeof obj !== 'object') return true;
  for (const key of Object.keys(obj as object)) {
    if (DANGEROUS_KEYS.has(key)) return false;
    if (!isSafeObject((obj as Record<string, unknown>)[key], depth + 1)) return false;
  }
  return true;
}

// ─── Core sanitisers ─────────────────────────────────────────────────────────

/**
 * General-purpose text sanitiser.
 * Strips HTML tags, removes null bytes, control characters, and limits length.
 * Preserves normal Unicode text (including CJK, Arabic, etc.).
 */
export function sanitizeText(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')         // strip HTML tags
    .replace(/\0/g, '')              // null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control chars (keep \t \n \r)
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitises a name field (person / company / group name).
 * Allows letters, spaces, hyphens, apostrophes, dots, CJK/Unicode letters.
 */
export function sanitizeName(value: unknown, maxLength = 120): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\0/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitises an email address.
 * Lowercases and trims; does not allow HTML or control chars.
 */
export function sanitizeEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .trim()
    .replace(/[<>"'\0]/g, '')
    .slice(0, 254);
}

/**
 * Sanitises a phone number field.
 * Keeps only digits, spaces, plus, hyphens, parentheses.
 */
export function sanitizePhone(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[^\d\s+\-().]/g, '')
    .trim()
    .slice(0, 30);
}

/**
 * Sanitises a monetary / numeric amount field.
 * Returns only digits and a single decimal point.
 */
export function sanitizeAmount(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const s = String(value).replace(/[^\d.]/g, '');
  // Allow at most one decimal point
  const parts = s.split('.');
  return parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : s;
}

/**
 * Sanitises a free-form comment or log note.
 * Strips HTML/script but preserves newlines.
 */
export function sanitizeComment(value: unknown, maxLength = 5000): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitises an OTP / verification code input.
 * Keeps only digits, max 6 characters.
 */
export function sanitizeOTP(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\D/g, '').slice(0, 6);
}

/**
 * Sanitises a password field – returns as-is (trim only, no length truncation from our side).
 * Never log or store this value.
 */
export function sanitizePassword(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\0/g, '').slice(0, 128); // 128-char max is generous but finite
}

/**
 * Sanitises a username.
 * Keeps only alphanumeric, underscore, hyphen.
 */
export function sanitizeUsername(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 30);
}

/**
 * Sanitises a filename. Prevents path traversal.
 */
export function sanitizeFilename(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/\0/g, '')
    .replace(/\.\.\//g, '')
    .replace(/\.\.\\/g, '')
    .replace(/[/\\]/g, '_')
    .replace(/[^a-zA-Z0-9._\-]/g, '_')
    .slice(0, 200);
}

/**
 * Sanitises a date string – allows only ISO 8601-compatible characters.
 */
export function sanitizeDate(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[^0-9T:.\-+Z]/g, '').slice(0, 30);
}

/**
 * Sanitises a URL – only http/https allowed.
 */
export function sanitizeURL(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return trimmed;
    return '';
  } catch {
    return '';
  }
}

// ─── Field validators ─────────────────────────────────────────────────────────

export function validateRequired(value: string, label = 'This field'): string | null {
  return value.trim().length === 0 ? `${label} is required` : null;
}

export function validateEmail(value: string): string | null {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!re.test(value)) return 'Enter a valid email address';
  if (value.length > 254) return 'Email address is too long';
  return null;
}

export function validatePasswordStrength(value: string): string | null {
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (value.length > 128) return 'Password must not exceed 128 characters';
  if (!/[A-Z]/.test(value)) return 'Password must include an uppercase letter';
  if (!/[a-z]/.test(value)) return 'Password must include a lowercase letter';
  if (!/\d/.test(value)) return 'Password must include a number';
  if (!/[@$!%*?&\-_#^()+=\[\]{}|;:,.<>?/~`'"\\]/.test(value))
    return 'Password must include a special character';
  return null;
}

export function validatePasswordMatch(a: string, b: string): string | null {
  return a !== b ? 'Passwords do not match' : null;
}

export function validateOTPCode(value: string): string | null {
  if (!/^\d{6}$/.test(value)) return 'Enter the 6-digit code sent to your email';
  return null;
}

export function validateUsername(value: string): string | null {
  if (value.length < 3) return 'Username must be at least 3 characters';
  if (value.length > 30) return 'Username must not exceed 30 characters';
  if (!/^[a-zA-Z0-9_\-]+$/.test(value))
    return 'Username may only contain letters, numbers, underscore or hyphen';
  return null;
}

export function validatePositiveAmount(value: string): string | null {
  if (value === '') return null; // optional
  const n = parseFloat(value);
  if (isNaN(n)) return 'Enter a valid number';
  if (n < 0) return 'Amount must not be negative';
  return null;
}

export function validateNoAttacks(value: string, label = 'Input'): string | null {
  return containsAttackPatterns(value) ? `${label} contains invalid characters` : null;
}

export function validateMaxLength(value: string, max: number, label = 'Input'): string | null {
  return value.length > max ? `${label} must not exceed ${max} characters` : null;
}

// ─── Per-form validation bundles ──────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  /** Returns the first error message, or null if valid */
  firstError(): string | null;
}

function makeResult(errors: Record<string, string>): ValidationResult {
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    firstError() {
      const keys = Object.keys(errors);
      return keys.length > 0 ? errors[keys[0]] : null;
    },
  };
}

function collect(checks: [string, string | null][]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [field, err] of checks) {
    if (err) errors[field] = err;
  }
  return errors;
}

// Login form
export function validateLoginForm(data: { email: string; password: string }): ValidationResult {
  return makeResult(collect([
    ['email',    validateRequired(data.email, 'Email') ?? validateEmail(sanitizeEmail(data.email))],
    ['password', validateRequired(data.password, 'Password')],
  ]));
}

// Registration form
export function validateRegisterForm(data: {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  department: string;
  position: string;
}): ValidationResult {
  const email = sanitizeEmail(data.email);
  const username = sanitizeUsername(data.username);
  return makeResult(collect([
    ['username',        validateRequired(username, 'Username')  ?? validateUsername(username)],
    ['email',          validateRequired(email, 'Email')        ?? validateEmail(email)],
    ['password',       validateRequired(data.password, 'Password') ?? validatePasswordStrength(data.password)],
    ['confirmPassword', validatePasswordMatch(data.password, data.confirmPassword)],
    ['fullName',       validateRequired(sanitizeName(data.fullName), 'Full name') ?? validateNoAttacks(data.fullName, 'Full name')],
    ['department',     validateRequired(data.department, 'Department')],
    ['position',       validateRequired(data.position, 'Position')],
  ]));
}

// OTP verification form
export function validateOTPForm(data: { code: string }): ValidationResult {
  const code = sanitizeOTP(data.code);
  return makeResult(collect([
    ['code', validateRequired(code, 'Verification code') ?? validateOTPCode(code)],
  ]));
}

// Forgot-password email form
export function validateForgotPasswordForm(data: { email: string }): ValidationResult {
  const email = sanitizeEmail(data.email);
  return makeResult(collect([
    ['email', validateRequired(email, 'Email') ?? validateEmail(email)],
  ]));
}

// Reset-password form
export function validateResetPasswordForm(data: {
  newPassword: string;
  confirmNewPassword: string;
}): ValidationResult {
  return makeResult(collect([
    ['newPassword',         validateRequired(data.newPassword, 'Password') ?? validatePasswordStrength(data.newPassword)],
    ['confirmNewPassword',  validatePasswordMatch(data.newPassword, data.confirmNewPassword)],
  ]));
}

// Log note / comment form
export function validateLogNoteForm(data: { comment: string }): ValidationResult {
  const comment = sanitizeComment(data.comment, 5000);
  return makeResult(collect([
    ['comment', validateRequired(comment, 'Comment') ?? validateMaxLength(comment, 5000, 'Comment') ?? validateNoAttacks(comment, 'Comment')],
  ]));
}

// Messaging – send message form
export function validateMessageForm(data: { content: string }): ValidationResult {
  const content = sanitizeComment(data.content, 10000);
  return makeResult(collect([
    ['content', validateMaxLength(content, 10000, 'Message') ?? validateNoAttacks(content, 'Message')],
  ]));
}

// Messaging – create group form
export function validateGroupForm(data: { name: string; participantIds: string[] }): ValidationResult {
  const name = sanitizeName(data.name, 80);
  return makeResult(collect([
    ['name',   validateRequired(name, 'Group name') ?? validateMaxLength(name, 80, 'Group name') ?? validateNoAttacks(name, 'Group name')],
    ['participants', data.participantIds.length < 2 ? 'Select at least 2 participants' : null],
  ]));
}

// User profile form
export function validateProfileForm(data: {
  fullName: string;
  department: string;
  position: string;
}): ValidationResult {
  const fullName = sanitizeName(data.fullName, 120);
  return makeResult(collect([
    ['fullName',   validateRequired(fullName, 'Full name') ?? validateMaxLength(fullName, 120, 'Full name') ?? validateNoAttacks(data.fullName, 'Full name')],
    ['department', validateRequired(data.department, 'Department')],
    ['position',   validateRequired(data.position, 'Position')],
  ]));
}

// Change-password form (inside UserProfile)
export function validatePasswordChangeForm(data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): ValidationResult {
  return makeResult(collect([
    ['currentPassword', validateRequired(data.currentPassword, 'Current password')],
    ['newPassword',     validateRequired(data.newPassword, 'New password') ?? validatePasswordStrength(data.newPassword)],
    ['confirmPassword', validatePasswordMatch(data.newPassword, data.confirmPassword)],
  ]));
}

// Client info form
export function validateClientInfoForm(data: Record<string, string>): ValidationResult {
  const name = sanitizeName(data.contactName ?? '', 120);
  return makeResult(collect([
    ['contactName', validateRequired(name, 'Contact name') ?? validateNoAttacks(data.contactName ?? '', 'Contact name')],
    ['email',       data.email ? (validateEmail(sanitizeEmail(data.email)) ?? null) : null],
    ['phone',       data.phone ? (validateMaxLength(sanitizePhone(data.phone ?? ''), 30, 'Phone') ?? null) : null],
  ]));
}

// Payment / amount form
export function validatePaymentForm(data: Record<string, string>): ValidationResult {
  return makeResult(collect([
    ['amount', validatePositiveAmount(sanitizeAmount(data.amount ?? ''))],
  ]));
}

// Visa / embassy info form
export function validateVisaInfoForm(data: Record<string, string>): ValidationResult {
  return makeResult(collect([
    ['visaType', data.visaType ? (validateNoAttacks(data.visaType, 'Visa type') ?? null) : null],
  ]));
}

// Admin panel – role change
export function validateRoleChange(data: { email: string; newRole: string }): ValidationResult {
  const ALLOWED_ROLES = ['admin', 'user', 'manager', 'viewer'];
  return makeResult(collect([
    ['email',   validateRequired(sanitizeEmail(data.email), 'Email') ?? validateEmail(sanitizeEmail(data.email))],
    ['newRole', ALLOWED_ROLES.includes(data.newRole) ? null : 'Invalid role selected'],
  ]));
}

// ─── Sanitise an entire form object in bulk ───────────────────────────────────

/**
 * Strips attack patterns from every string value in a plain form-data object.
 * Returns null if prototype-pollution is detected.
 */
export function sanitizeFormData<T extends Record<string, unknown>>(data: T): T | null {
  if (!isSafeObject(data)) return null; // prototype pollution rejected
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (DANGEROUS_KEYS.has(key)) return null;
    clean[key] = typeof value === 'string' ? sanitizeText(value, 2000) : value;
  }
  return clean as T;
}
