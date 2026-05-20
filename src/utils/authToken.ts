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

// ── Auth failure backoff (prevents repeated 401/403 request storms) ────────
const AUTH_BACKOFF_STEPS_MS = [15000, 30000, 60000, 120000, 300000];
let _authFailureCount = 0;
let _authBackoffUntil = 0;

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

/** Returns the stored JWT, or null if not present or expired. */
export function getAuthToken(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    
    // Check if token is expired
    if (isTokenExpired(token)) {
      clearAuthToken();
      return null;
    }
    
    return token;
  } catch {
    return null;
  }
}

/** Checks if a JWT token is expired without verifying the signature. */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false;
    
    // Check if token expires in the next 5 minutes (300 seconds)
    // This gives a buffer to avoid mid-request expiry
    return Date.now() >= (payload.exp * 1000) - (5 * 60 * 1000);
  } catch {
    return true; // If we can't parse it, treat as expired
  }
}

/** Persists the JWT token returned by the login endpoint. */
export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    resetAuthBackoff();
  } catch {
    // localStorage unavailable (private browsing, full storage, etc.)
    console.warn('[Auth] Could not persist auth token');
  }
}

/** Removes the JWT — call on logout or session expiry. */
export function clearAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    resetAuthBackoff();
  } catch {
    // ignore
  }
}

/** True when authenticated polling should pause due to recent auth failures. */
export function shouldBackoffAuthRequests(): boolean {
  return Date.now() < _authBackoffUntil;
}

/** Remaining auth backoff time in milliseconds. */
export function getAuthBackoffRemainingMs(): number {
  return Math.max(0, _authBackoffUntil - Date.now());
}

/** Clears accumulated auth failure backoff after a successful authenticated call. */
export function resetAuthBackoff(): void {
  _authFailureCount = 0;
  _authBackoffUntil = 0;
}

/**
 * Records an auth failure (401/403) and increases cooldown to reduce request spam.
 * Cooldown escalates up to 5 minutes when failures continue.
 * 
 * For 401 errors, also triggers a logout event to force re-authentication.
 */
export function recordAuthFailure(status: number): void {
  if (status !== 401 && status !== 403) return;

  _authFailureCount = Math.min(_authFailureCount + 1, AUTH_BACKOFF_STEPS_MS.length);
  const cooldownMs = AUTH_BACKOFF_STEPS_MS[_authFailureCount - 1];
  _authBackoffUntil = Date.now() + cooldownMs;
  
  // On 401, clear the token and trigger logout
  if (status === 401) {
    clearAuthToken();
    // Dispatch a custom event that App.tsx can listen to
    window.dispatchEvent(new CustomEvent('auth:expired'));
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
