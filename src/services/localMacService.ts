import type { LocalMacConfig } from '../types/storage';

const API_TIMEOUT_MS = 10000;

function macUrl(config: LocalMacConfig, path: string): string {
  // If ip looks like a full URL (e.g. https://abc.loca.lt), use it directly
  if (config.ip.startsWith('http://') || config.ip.startsWith('https://')) {
    return `${config.ip.replace(/\/$/, '')}${path}`;
  }
  return `http://${config.ip}:${config.port}${path}`;
}

function isTunnelUrl(config: LocalMacConfig): boolean {
  return config.ip.startsWith('http://') || config.ip.startsWith('https://');
}

function baseHeaders(config: LocalMacConfig): Record<string, string> {
  const headers: Record<string, string> = {};
  if (isTunnelUrl(config)) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }
  return headers;
}

function authHeader(config: LocalMacConfig): Record<string, string> {
  return { ...baseHeaders(config), Authorization: `Bearer ${config.token}` };
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = API_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/** Returns true if the Mac server is reachable. */
export async function checkLocalMacConnection(config: LocalMacConfig): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(macUrl(config, '/health'), { headers: baseHeaders(config) }, 5000);
    return res.ok;
  } catch {
    return false;
  }
}

export interface MacUploadResult {
  success: boolean;
  url: string;
  path: string;
  filename: string;
  error?: string;
}

/** Upload a File to the Mac server under the given folder. */
export async function uploadFileToLocalMac(
  file: File,
  folder: string,
  config: LocalMacConfig
): Promise<MacUploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  // Sanitise folder name — local-device-server enforces the same rule
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '-');

  try {
    const res = await fetchWithTimeout(
      macUrl(config, `/upload/${safeFolder}`),
      { method: 'POST', headers: authHeader(config), body: formData }
    );

    if (!res.ok) {
      const text = await res.text();
      return { success: false, url: '', path: '', filename: '', error: `Server error ${res.status}: ${text}` };
    }

    const data = await res.json();
    return {
      success: true,
      url: data.url,
      path: data.path,
      filename: data.filename,
    };
  } catch (err: any) {
    return { success: false, url: '', path: '', filename: '', error: err?.message ?? 'Network error' };
  }
}

/** Delete a file from the Mac server. */
export async function deleteFileFromLocalMac(
  folder: string,
  filename: string,
  config: LocalMacConfig
): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      macUrl(config, `/files/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`),
      { method: 'DELETE', headers: authHeader(config) }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Build the direct HTTP URL for a Mac-stored file (no request made). */
export function getLocalMacFileUrl(folder: string, filename: string, config: LocalMacConfig): string {
  return macUrl(config, `/files/${folder}/${filename}`);
}

export interface BackupFileEntry {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

/** List backup files on the Mac server. */
export async function listMacBackups(config: LocalMacConfig): Promise<BackupFileEntry[]> {
  try {
    const res = await fetchWithTimeout(
      macUrl(config, '/backup'),
      { headers: authHeader(config) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.files ?? [];
  } catch {
    return [];
  }
}

/** Download a backup JSON file from the Mac server and return it as parsed JSON. */
export async function downloadMacBackup(filename: string, config: LocalMacConfig): Promise<object | null> {
  try {
    const res = await fetchWithTimeout(
      macUrl(config, `/backup/${encodeURIComponent(filename)}`),
      { headers: authHeader(config) }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
