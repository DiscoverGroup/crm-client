/**
 * User Service — admin-facing user management API.
 *
 * Wraps the Netlify functions used by the AdminPanel:
 *   - GET  get-users         → list users
 *   - POST add-user          → create user (admin)
 *   - POST approve-user      → approve/reject pending users
 *   - POST delete-user       → remove a user
 *
 * All calls include the JWT + CSRF headers via authHeaders().
 */
import { authHeaders, initCsrfToken } from '../utils/authToken';

export interface UserRecord {
  id: string;
  email: string;
  username: string;
  fullName: string;
  department: string;
  position: string;
  profileImage?: string;
  isVerified: boolean;
  role: 'admin' | 'user' | 'intern';
  approvalStatus: 'pending' | 'approved' | 'rejected';
  registrationMethod?: 'auth0' | 'manual';
  createdAt?: string | null;
  registeredAt?: string | null;
}

export interface AddUserPayload {
  username: string;
  email: string;
  password: string;
  fullName: string;
  department: string;
  position: string;
  role?: 'admin' | 'user' | 'intern';
  autoApprove?: boolean;
  autoVerify?: boolean;
}

const BASE = '/.netlify/functions';

async function jsonFetch<T>(url: string, init: RequestInit, retryOnCsrf = true): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init.headers || {}),
    },
  });

  // One-shot retry on CSRF expiry
  if (res.status === 403 && retryOnCsrf) {
    let body: any = null;
    try { body = await res.clone().json(); } catch { /* ignore */ }
    if (typeof body?.error === 'string' && /csrf/i.test(body.error)) {
      await initCsrfToken();
      return jsonFetch<T>(url, init, false);
    }
  }

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* keep raw */ }

  if (!res.ok) {
    const message =
      (data && (data.error || data.message)) ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export const UserService = {
  async listUsers(): Promise<UserRecord[]> {
    const data = await jsonFetch<{ success: boolean; users: UserRecord[] }>(
      `${BASE}/get-users`,
      { method: 'GET' },
    );
    return data.users || [];
  },

  async addUser(payload: AddUserPayload): Promise<UserRecord> {
    const data = await jsonFetch<{ success: boolean; user: UserRecord }>(
      `${BASE}/add-user`,
      { method: 'POST', body: JSON.stringify(payload) },
    );
    return data.user;
  },

  async approveUser(email: string, action: 'approve' | 'reject'): Promise<void> {
    await jsonFetch(`${BASE}/approve-user`, {
      method: 'POST',
      body: JSON.stringify({ email, action }),
    });
  },

  async deleteUser(email: string): Promise<void> {
    await jsonFetch(`${BASE}/delete-user`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
};

export default UserService;
