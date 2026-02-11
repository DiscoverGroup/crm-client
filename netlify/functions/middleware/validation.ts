/**
 * Input Validation Middleware
 * Provides reusable validation functions for API endpoints
 */

import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import {
  isValidEmail,
  isValidPassword,
  isValidUsername,
  isValidStringId,
  isValidMessageContent,
  validateUserRegistration,
  validateUserLogin,
  validateMessage,
  sanitizeInput,
  sanitizeEmail,
  getSecurityHeaders,
  getCORSHeaders
} from '../utils/securityUtils';

// ============================================
// REQUEST VALIDATION HELPERS
// ============================================

/**
 * Validates and returns JSON body
 */
export function parseRequestBody(event: HandlerEvent): { valid: boolean; data?: any; error?: string } {
  try {
    if (!event.body) {
      return { valid: false, error: 'Request body is empty' };
    }

    const data = JSON.parse(event.body);
    return { valid: true, data };
  } catch (err) {
    return { valid: false, error: 'Invalid JSON in request body' };
  }
}

/**
 * Validates login request
 */
export function validateLoginRequest(data: any): { valid: boolean; data?: any; errors?: string[] } {
  const validation = validateUserLogin(data);
  
  if (!validation.valid) {
    return { valid: false, errors: validation.errors };
  }

  const sanitized = {
    email: sanitizeEmail(data.email),
    password: data.password // Don't modify password
  };

  return { valid: true, data: sanitized };
}

/**
 * Validates registration request
 */
export function validateRegistrationRequest(data: any): { valid: boolean; data?: any; errors?: string[] } {
  const validation = validateUserRegistration(data);
  
  if (!validation.valid) {
    return { valid: false, errors: validation.errors };
  }

  const sanitized = {
    email: sanitizeEmail(data.email),
    username: data.username.trim(),
    password: data.password, // Don't modify password
    fullName: sanitizeInput(data.fullName)
  };

  return { valid: true, data: sanitized };
}

/**
 * Validates message request
 */
export function validateMessageRequest(data: any): { valid: boolean; data?: any; errors?: string[] } {
  const validation = validateMessage(data);
  
  if (!validation.valid) {
    return { valid: false, errors: validation.errors };
  }

  const sanitized = {
    fromUserId: data.fromUserId.trim(),
    toUserId: data.toUserId ? data.toUserId.trim() : undefined,
    groupId: data.groupId ? data.groupId.trim() : undefined,
    content: sanitizeInput(data.content),
    attachments: Array.isArray(data.attachments) ? data.attachments.slice(0, 10) : undefined
  };

  return { valid: true, data: sanitized };
}

/**
 * Validates password reset request
 */
export function validatePasswordResetRequest(data: any): { valid: boolean; data?: any; errors?: string[] } {
  const errors: string[] = [];

  if (!isValidEmail(data.email)) {
    errors.push('Invalid email format');
  }

  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? { email: sanitizeEmail(data.email) } : undefined,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Validates password change request
 */
export function validatePasswordChangeRequest(data: any): { valid: boolean; data?: any; errors?: string[] } {
  const errors: string[] = [];

  if (!data.oldPassword || typeof data.oldPassword !== 'string') {
    errors.push('Current password is required');
  }

  if (!isValidPassword(data.newPassword)) {
    errors.push('New password must be at least 8 characters with uppercase, lowercase, number, and special character');
  }

  if (!data.confirmPassword || data.newPassword !== data.confirmPassword) {
    errors.push('Passwords do not match');
  }

  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? { oldPassword: data.oldPassword, newPassword: data.newPassword } : undefined,
    errors: errors.length > 0 ? errors : undefined
  };
}

// ============================================
// RESPONSE HELPERS
// ============================================

/**
 * Creates a successful response
 */
export function successResponse(
  statusCode: number = 200,
  data: any,
  corsOrigin?: string
): HandlerResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...getSecurityHeaders(),
      ...getCORSHeaders(corsOrigin)
    },
    body: JSON.stringify(data)
  };
}

/**
 * Creates an error response
 */
export function errorResponse(
  statusCode: number = 400,
  message: string,
  errors?: string[],
  corsOrigin?: string
): HandlerResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...getSecurityHeaders(),
      ...getCORSHeaders(corsOrigin)
    },
    body: JSON.stringify({
      success: false,
      error: message,
      ...(errors && { errors })
    })
  };
}

/**
 * Creates a validation error response
 */
export function validationErrorResponse(
  errors: string[],
  corsOrigin?: string
): HandlerResponse {
  return errorResponse(400, 'Validation failed', errors, corsOrigin);
}

// ============================================
// METHOD VALIDATION
// ============================================

/**
 * Validates HTTP method
 */
export function validateHttpMethod(
  event: HandlerEvent,
  allowedMethods: string[] = ['GET', 'POST', 'OPTIONS']
): { valid: boolean; corsResponse?: HandlerResponse } {
  if (event.httpMethod === 'OPTIONS') {
    return {
      valid: false,
      corsResponse: {
        statusCode: 200,
        headers: {
          ...getSecurityHeaders(),
          ...getCORSHeaders()
        },
        body: ''
      }
    };
  }

  if (!allowedMethods.includes(event.httpMethod)) {
    return {
      valid: false,
      corsResponse: errorResponse(405, `Method ${event.httpMethod} not allowed`)
    };
  }

  return { valid: true };
}

// ============================================
// WRAPPER FUNCTION FOR API HANDLERS
// ============================================

/**
 * High-order function that wraps API handlers with security checks
 * Usage:
 * export const handler = withSecurityValidation(async (event, context) => {
 *   // your handler logic
 * }, { allowedMethods: ['POST'] });
 */
export function withSecurityValidation(
  handlerFn: (event: HandlerEvent, context: any) => Promise<HandlerResponse>,
  options: {
    allowedMethods?: string[];
    requireBody?: boolean;
    corsOrigin?: string;
  } = {}
): Handler {
  const {
    allowedMethods = ['GET', 'POST', 'OPTIONS'],
    requireBody = true,
    corsOrigin
  } = options;

  return async (event: HandlerEvent, context: any) => {
    try {
      // 1. Validate HTTP method
      const methodValidation = validateHttpMethod(event, allowedMethods);
      if (!methodValidation.valid && methodValidation.corsResponse) {
        return methodValidation.corsResponse;
      }

      // 2. Validate body if required
      if (requireBody && !event.body) {
        return validationErrorResponse(['Request body is required'], corsOrigin);
      }

      // 3. Call the actual handler
      const response = await handlerFn(event, context);
      return response;
    } catch (error) {
      console.error('Security validation error:', error);
      return errorResponse(500, 'Internal server error', undefined, corsOrigin);
    }
  };
}
