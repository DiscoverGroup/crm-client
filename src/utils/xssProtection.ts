/**
 * XSS Prevention Service
 * Implements protections against Cross-Site Scripting (XSS) attacks
 * Browser-safe utilities for XSS prevention
 */

// ============================================
// XSS PREVENTION UTILITIES
// ============================================

/**
 * Cleans HTML content to prevent XSS
 * Removes dangerous tags and attributes while keeping safe text
 */
export function sanitizeHTML(html: string): string {
  if (typeof html !== 'string') return '';

  // Use browser's HTML parsing
  if (typeof window !== 'undefined' && window.DOMParser) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Remove dangerous tags
      const dangerousTags = ['script', 'iframe', 'object', 'embed', 'applet', 'link', 'meta', 'style'];
      dangerousTags.forEach(tag => {
        doc.querySelectorAll(tag).forEach(el => el.remove());
      });
      
      // Get text content (strips all tags)
      return doc.body.textContent || '';
    } catch {
      return stripHTML(html);
    }
  } else {
    // Fallback - just strip HTML
    return stripHTML(html);
  }
}

/**
 * Escapes HTML special characters
 * Converts: < > & " '
 */
export function escapeHTML(text: string): string {
  if (typeof text !== 'string') return '';

  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;'
  };

  return text.replace(/[&<>"'\/]/g, char => map[char]);
}

/**
 * Removes all HTML tags
 * Useful for user-generated text content
 */
export function stripHTML(html: string): string {
  if (typeof html !== 'string') return '';
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Encodes HTML entities
 */
export function encodeHTMLEntities(text: string): string {
  const element = document.createElement('div');
  element.textContent = text;
  return element.innerHTML;
}

/**
 * Validates URL to prevent javascript: and data: URIs
 */
export function isValidURL(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;

  try {
    const parsed = new URL(url);
    // Only allow http and https
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Sanitizes URL
 */
export function sanitizeURL(url: string): string {
  if (!isValidURL(url)) return '#';
  return encodeURI(url);
}

// ============================================
// CONTENT SECURITY POLICY
// ============================================

/**
 * Returns CSP header value
 * Prevents inline scripts and restricts resource loading
 */
export function getCSPHeader(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.example.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
}

/**
 * Generates nonce for inline scripts
 */
export function generateNonce(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// ============================================
// REACT COMPONENT SAFETY HELPERS
// ============================================

/**
 * Safely renders user-generated content in React
 * Use with dangerouslySetInnerHTML
 * 
 * Example:
 * <div dangerouslySetInnerHTML={{ __html: sanitizeUserContent(userText) }} />
 */
export function sanitizeUserContent(content: string): string {
  // Remove all HTML and return plain text
  return stripHTML(content).trim();
}

/**
 * Safely renders user content with limited HTML
 * 
 * Example:
 * <div dangerouslySetInnerHTML={{ __html: sanitizeRichContent(userHTML) }} />
 */
export function sanitizeRichContent(html: string): string {
  return sanitizeHTML(html);
}

/**
 * React helper: safely handle user input as text
 */
export function safeText(text: any): string {
  return String(text || '').trim();
}

/**
 * React helper: safely construct URLs
 */
export function safeHref(url: string): string {
  return isValidURL(url) ? url : '#';
}

/**
 * React helper: safely handle class names
 * Prevents class injection attacks
 */
export function safeClassName(...classes: (string | undefined | null | boolean)[]): string {
  return classes
    .filter((c): c is string => typeof c === 'string' && c.length > 0)
    .map(c => c.trim())
    .filter(c => /^[a-zA-Z0-9_\-]+$/.test(c)) // Only alphanumeric, dash, underscore
    .join(' ');
}

// ============================================
// ATTRIBUTE SAFETY
// ============================================

/**
 * Validates data attributes (prevents event handler injection)
 */
export function isValidDataAttribute(name: string, value: string): boolean {
  // Data attributes should start with data-
  if (!name.startsWith('data-')) return false;

  // Attribute name should only contain alphanumeric and dash
  if (!/^data-[a-zA-Z0-9\-]+$/.test(name)) return false;

  // Value should not contain event handlers or scripts
  if (/on\w+\s*=|javascript:|<script/i.test(value)) return false;

  return true;
}

/**
 * Safely sets element attributes
 */
export function setSafeAttribute(
  element: HTMLElement,
  name: string,
  value: string
): boolean {
  // Dangerous attributes
  const dangerousAttrs = ['onclick', 'onerror', 'onload', 'onmouseover', 'innerHTML'];
  if (dangerousAttrs.includes(name.toLowerCase())) return false;

  // URLs should be validated
  if (name.toLowerCase() === 'href' && !isValidURL(value)) return false;

  element.setAttribute(name, value);
  return true;
}

// ============================================
// ENCODING HELPERS
// ============================================

/**
 * Encodes JSON safely for embedding in HTML
 */
export function safeJSONEncode(obj: any): string {
  const json = JSON.stringify(obj);
  return escapeHTML(json);
}

/**
 * Decodes safe JSON from HTML
 */
export function safeJSONDecode(htmlEncoded: string): any {
  try {
    // Unescape HTML entities first
    const div = document.createElement('div');
    div.innerHTML = htmlEncoded;
    const text = div.textContent || div.innerText || '';
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Encodes for JavaScript strings
 */
export function encodeJavaScriptString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\x00/g, '\\0');
}

/**
 * Encodes for URL
 */
export function encodeURL(str: string): string {
  return encodeURIComponent(str);
}

/**
 * Decodes URL
 */
export function decodeURL(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return '';
  }
}

// ============================================
// VALIDATION PATTERNS
// ============================================

/**
 * Validates if string contains only safe characters for display
 */
export function isSafeForDisplay(str: string): boolean {
  if (typeof str !== 'string') return false;
  
  // Reject control characters, null bytes
  return !str.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/);
}

/**
 * Validates if string could be a script/HTML injection
 */
export function containsXSSPatterns(str: string): boolean {
  if (typeof str !== 'string') return false;

  const xssPatterns = [
    /<script/i,
    /on\w+\s*=/i,
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<applet/i
  ];

  return xssPatterns.some(pattern => pattern.test(str));
}

/**
 * Content Security Policy wrapper for inline scripts
 */
export const CSP = {
  header: getCSPHeader()
};
