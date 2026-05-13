# CRM Client — Agent Instructions

## Project Overview

React 19 + TypeScript SPA deployed on **Netlify** (CDN + serverless functions). Backend logic lives entirely in `netlify/functions/`. Storage is Cloudflare R2 (S3-compatible). Auth is Auth0 (PKCE). Database is MongoDB Atlas.

## Architecture

```
src/                  → React frontend (Vite + Tailwind + MUI)
netlify/functions/    → Serverless backend (Node/TypeScript)
local-device-server/  → Optional LAN server for local MinIO storage
```

Key directories:
- `netlify/functions/utils/` — shared auth middleware, CORS helpers, rate limiting, input validation
- `src/services/` — API client wrappers for Netlify functions
- `src/utils/` — client-side security helpers (xssProtection, securityUtils, authToken)
- `src/components/` — React UI (AdminPanel, messaging, tickets, payments)
- `docs/` — architecture/security docs (link, don't duplicate)

## Build & Dev Commands

```bash
npm run build          # tsc + vite build
npm run dev            # vite only (frontend)
npm run dev:local      # vite + local functions server + tunnel (full stack)
npm run netlify        # netlify dev (mirrors production routing)
npm run lint           # eslint
npm run check          # pre-push safety checks (scripts/pre-push-check.sh)
```

## Environment Variables

**Never use `VITE_` prefix for secrets.** `VITE_` vars are bundled into the client JS.

| Safe (public) | Dangerous if leaked |
|---|---|
| `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID` | `R2_SECRET_ACCESS_KEY` (server-only) |
| `VITE_R2_PUBLIC_URL`, `VITE_R2_BUCKET_NAME` | `JWT_SECRET`, `MONGODB_URI` |
| `VITE_API_URL` | `SETUP_SECRET`, `EMAIL_*` credentials |

Server-only secrets go in Netlify environment variables and are accessed via `process.env.*` inside `netlify/functions/` only.

## Security Architecture

See [docs/security/](docs/security/) for full documentation. Key patterns:

- **Auth**: Auth0 PKCE flow → JWT validated in `netlify/functions/middleware/authMiddleware.ts`
- **Rate limiting**: `netlify/functions/utils/rateLimiting.ts` — apply to all mutating endpoints
- **Input validation**: `netlify/functions/utils/inputValidation.ts` — sanitize before DB ops
- **CORS**: `netlify/functions/utils/securityUtils.ts#getCORSHeaders()` — never use `*` with credentials
- **CSRF utilities**: `netlify/functions/utils/csrfProtection.ts` — **import and use in every POST/PUT/DELETE handler**
- **XSS**: `src/utils/xssProtection.ts` — use `sanitizeRichContent()` before any `dangerouslySetInnerHTML`

---

## ⚠️ Open Security Issues (Prioritized)

These are known vulnerabilities. Fix them before adding new features in affected areas.

### CRITICAL

**C1 — `VITE_R2_SECRET_ACCESS_KEY` in client bundle**
- File: `src/App.tsx` line ~212
- Any `VITE_` secret is exposed in the browser bundle.
- Fix: Remove entirely. All R2 ops must go through Netlify functions using server-side presigned URLs.

### HIGH

**H1 — `unsafe-inline` in CSP `script-src`**
- File: `netlify.toml` (CSP header)
- Defeats XSS protection provided by Content-Security-Policy.
- Fix: Remove `'unsafe-inline'`; replace inline scripts with external files or use nonce/hash-based CSP.

**H2 — `Cross-Origin-Opener-Policy: unsafe-none`**
- File: `netlify.toml`
- Allows cross-origin windows to access `window.opener`.
- Fix: Change to `"same-origin-allow-popups"` — Auth0 popups still work.

**H3 — Sensitive data in `localStorage` (plaintext)**
- Files: `src/services/fileService.ts`, `src/services/logNoteService.ts`, `src/services/workflowService.ts`, `src/components/AdminPanel.tsx`
- PII and config data readable by any JS (XSS vector).
- Fix: Use `sessionStorage` for transient caches; never store tokens or PII in localStorage; prefer server-side state.

**H4 — CSRF protection utilities exist but are not wired up**
- File: `netlify/functions/utils/csrfProtection.ts` (exists, unused)
- Every POST/PUT/DELETE function is currently unprotected.
- Fix: Import `validateCSRFToken` / `extractCSRFToken` at the top of every mutating function. Add `SameSite=Strict` to cookies.

### MEDIUM

**M1 — JWT tokens stored in `localStorage`**
- File: `src/utils/authToken.ts`
- XSS can steal tokens. Prefer HTTP-only `Secure SameSite=Strict` cookies set by the server.

**M2 — JWT expiry set to 24 hours**
- File: `netlify/functions/middleware/authMiddleware.ts` (`expiresIn: '24h'`)
- Fix: Reduce to `1h` access token + `7d` HTTP-only refresh token.

**M3 — `seed-admin` and `get-storage-config` endpoints lack rate limiting**
- Fix: Apply `checkRateLimit()` from `utils/rateLimiting.ts` before any DB interaction.

**M4 — CORS helper falls back to `localhost:3000` when `ALLOWED_ORIGIN` unset**
- File: `netlify/functions/utils/securityUtils.ts#getCORSHeaders()`
- Fix: Throw an error (fail-closed) if `ALLOWED_ORIGIN` is not set in production.

**M5 — Password minimum length is 8 chars (below NIST 2023 recommendation of 12)**
- File: `src/utils/securityUtils.ts`
- Fix: Update regex to require 12–128 chars and accept a broader special-char set.

**M6 — `dangerouslySetInnerHTML` without DOMPurify**
- Files: search for `dangerouslySetInnerHTML` in `src/`
- Always wrap: `DOMPurify.sanitize(html)` — install `dompurify` + `@types/dompurify`.

**M7 — Outdated / vulnerable dependencies**
- `jsonwebtoken@9.0.3`, `axios@1.12.2`, `bcryptjs@3.0.3` (deprecated)
- Run `npm audit` after every `npm install`. Replace `bcryptjs` with Node built-in `crypto.scrypt` or `argon2`.

---

## Coding Conventions

### Security Rules (enforce on every change)

1. **Never put secrets in `VITE_` env vars.** Server secrets → `process.env.*` inside `netlify/functions/` only.
2. **Every `netlify/functions/` POST/PUT/DELETE must call `validateCSRFToken`.** See `csrfProtection.ts`.
3. **Every `netlify/functions/` mutating endpoint must call `checkRateLimit`.** See `rateLimiting.ts`.
4. **Never use `dangerouslySetInnerHTML` without `DOMPurify.sanitize()`.** No exceptions.
5. **Auth check first.** Every Netlify function that reads/writes user data must validate the JWT before any other logic.
6. **MongoDB queries use parameterized documents.** Never concatenate user input into query strings.
7. **File uploads**: validate MIME type, enforce size limits, and run through `netlify/functions/upload.ts` — no direct client-to-R2 uploads with credentials.

### TypeScript / React Patterns

- Netlify function handler signature: `Handler` from `@netlify/functions`
- Shared response helpers: `successResponse()`, `errorResponse()`, `tooManyRequestsResponse()` in `netlify/functions/utils/securityUtils.ts`
- All DB access goes through `netlify/functions/database.ts` connection pool
- Client API calls go through `src/services/` — do not call Netlify function URLs directly from components

### Pre-push Checklist

```bash
npm run check          # runs scripts/pre-push-check.sh
npm audit              # dependency vulnerability scan
```
