---
description: "Run a full OWASP Top 10 security audit on this codebase. Use when: reviewing security before a release, after adding new endpoints, or after dependency updates."
name: "Security Audit"
argument-hint: "Optional: scope a specific area (e.g. 'netlify/functions/send-message.ts' or 'auth flow')"
agent: "agent"
tools: [read, search]
---

Act as a Senior Cybersecurity Engineer. Audit this React/TypeScript + Netlify Functions CRM codebase against the OWASP Top 10 (2021).

## Scope

$input (if empty, audit the full codebase)

## What to Check

### A01 — Broken Access Control
- Every `netlify/functions/` handler: does it call `verifyAuth()` before touching data?
- Role/permission checks: are admin-only routes guarded?
- Search for functions missing auth: [netlify/functions/](netlify/functions/)

### A02 — Cryptographic Failures
- `VITE_*` environment variables: any secrets bundled into client? Check [src/App.tsx](src/App.tsx), [src/config/](src/config/)
- JWT storage: `localStorage` vs HTTP-only cookies → [src/utils/authToken.ts](src/utils/authToken.ts)
- JWT expiry setting → [netlify/functions/middleware/authMiddleware.ts](netlify/functions/middleware/authMiddleware.ts)

### A03 — Injection
- `dangerouslySetInnerHTML` without `DOMPurify.sanitize()` → search `src/`
- MongoDB queries: any string concatenation with user input? → [netlify/functions/](netlify/functions/)
- Eval or `new Function()` usage?

### A04 — Insecure Design
- CSRF: is `validateCSRFToken` called in every POST/PUT/DELETE? → [netlify/functions/utils/csrfProtection.ts](netlify/functions/utils/csrfProtection.ts)
- Sensitive data in `localStorage`/`sessionStorage`? → [src/services/](src/services/), [src/components/](src/components/)

### A05 — Security Misconfiguration
- CSP header: `unsafe-inline` present? → [netlify.toml](netlify.toml)
- `Cross-Origin-Opener-Policy` value → [netlify.toml](netlify.toml)
- CORS fallback behavior when `ALLOWED_ORIGIN` unset → [netlify/functions/utils/securityUtils.ts](netlify/functions/utils/securityUtils.ts)

### A06 — Vulnerable & Outdated Components
- Review [package.json](package.json) for: `jsonwebtoken`, `bcryptjs`, `axios`, `@aws-sdk/*`
- Flag deprecated packages (bcryptjs → native `crypto.scrypt` or `argon2`)

### A07 — Identification & Authentication Failures
- Password validation rules → [src/utils/securityUtils.ts](src/utils/securityUtils.ts) (require ≥12 chars, ≤128)
- Rate limiting on auth endpoints → [netlify/functions/utils/rateLimiting.ts](netlify/functions/utils/rateLimiting.ts)
- Missing rate limits on sensitive endpoints: `seed-admin`, `get-storage-config`

### A08 — Software & Data Integrity
- File upload handlers: MIME validation + size limits → [netlify/functions/upload.ts](netlify/functions/upload.ts)
- No direct client-to-R2 uploads with credentials

### A09 — Security Logging & Monitoring
- Are failed auth attempts logged?
- Are rate-limit hits logged?

### A10 — SSRF
- Any server-side HTTP calls with user-controlled URLs?

## Output Format

Return findings as a markdown table, then detailed entries:

| # | Severity | OWASP | File | Line | Description |
|---|----------|-------|------|------|-------------|

For each CRITICAL/HIGH finding, include:
- **Vulnerable code snippet**
- **Concrete fix with code example**

End with a **Positive Findings** section for security controls already working correctly.
Compare findings against the known backlog in [AGENTS.md](../../AGENTS.md) and flag any **new** issues not yet tracked.
