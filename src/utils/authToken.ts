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

// ── CSRF token (in-memory only, refreshed on app start) ─────────────────────
let _csrfToken: string | null = null;

/** Stores a CSRF token issued by the server. */
export function setCsrfToken(token: string): void {
  _csrfToken = token;
}

/** Returns the cached CSRF token, or null if not yet fetched. */
export function getCsrfToken(): string | null {
  return _csrfToken;
}

/**
 * Fetches a fresh CSRF token from the server and caches it in memory.
 * Call once on app startup (e.g. in App.tsx useEffect).
 * Non-fatal — if the fetch fails the token stays null and requests will be
 * rejected by CSRF validation, surfacing the network issue clearly.
 */
export async function initCsrfToken(): Promise<void> {
  try {
    const res = await fetch('/.netlify/functions/get-csrf-token');
    if (res.ok) {
      const data = await res.json() as { token?: string };
      if (data.token) setCsrfToken(data.token);
    }
  } catch {
    // Non-critical — callers will see 403s until the token is available
  }
}

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
 * Automatically includes X-CSRF-Token if a token has been initialised.
 * Example:
 *   fetch(url, { headers: { ...authHeaders(), 'Content-Type': 'application/json' } })
 */
export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (_csrfToken) headers['X-CSRF-Token'] = _csrfToken;
  return headers;
}
