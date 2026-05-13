/**
 * GET /.netlify/functions/get-csrf-token
 *
 * Returns a fresh stateless HMAC-signed CSRF token.
 * Called by the client on app initialisation; the token is stored in memory
 * and included as the X-CSRF-Token header on every subsequent POST/PUT/DELETE.
 *
 * No authentication required — the token proves the request originated from
 * a browser that can reach this server, not from a cross-site attacker.
 */

import type { Handler } from '@netlify/functions';
import { generateCSRFToken } from './utils/csrfProtection';
import { getCORSHeaders, getSecurityHeaders } from './utils/securityUtils';

export const handler: Handler = async (event) => {
  const headers = { ...getCORSHeaders(), ...getSecurityHeaders() };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const token = generateCSRFToken();
  return {
    statusCode: 200,
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  };
};
