/**
 * Client-side JWT token manager.
 *
 * Stores the JWT returned by the login endpoint in localStorage.
 * Every protected API call should include this token in the
 * `Authorization: Bearer <token>` header.
 *
 * Usage:
 *   import { getAuthToken, setAuthToken, clearAuthToken, authHeaders } from '../utils/authToken';
 *
 *   // After login:
 *   setAuthToken(result.token);
 *
 *   // In fetch calls:
 *   const response = await fetch('/api/endpoint', {
 *     headers: { ...authHeaders(), 'Content-Type': 'application/json' }
 *   });
 *
 *   // On logout:
 *   clearAuthToken();
 */

const TOKEN_KEY = 'crm_jwt_token';

/** Returns the stored JWT, or null if not present. */
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Persists the JWT token returned by the login endpoint. */
export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // localStorage unavailable (private browsing, full storage, etc.)
    console.warn('[Auth] Could not persist auth token');
  }
}

/** Removes the JWT — call on logout or session expiry. */
export function clearAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

/**
 * Returns headers suitable for authenticated fetch calls.
 * Example:
 *   fetch(url, { headers: { ...authHeaders(), 'Content-Type': 'application/json' } })
 */
export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
