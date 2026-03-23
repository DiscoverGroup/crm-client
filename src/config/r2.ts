/**
 * r2.ts — legacy browser S3 client (credentials removed)
 *
 * File operations now go through authenticated Netlify functions:
 *   netlify/functions/get-upload-url.ts
 *   netlify/functions/delete-file.ts
 *
 * The MinIO credentials (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT)
 * are server-side only (no VITE_ prefix) and never compiled into the browser bundle.
 *
 * The only browser-visible env var is VITE_R2_PUBLIC_URL (just a base URL, no secret).
 */

export {};


