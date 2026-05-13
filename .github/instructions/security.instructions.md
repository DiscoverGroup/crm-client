---
applyTo: "netlify/functions/**,src/utils/authToken.ts,src/utils/securityUtils.ts,src/utils/xssProtection.ts"
---

# Security Rules for Netlify Functions & Security Utilities

## Required Pattern: Every Mutating Function

All `POST`, `PUT`, `DELETE` Netlify functions **must** follow this order:

```typescript
import { validateCSRFToken, extractCSRFToken } from './utils/csrfProtection';
import { checkRateLimit, getClientIP } from './utils/rateLimiting';
import { verifyAuth } from './middleware/authMiddleware';
import { getCORSHeaders, errorResponse, tooManyRequestsResponse } from './utils/securityUtils';

export const handler: Handler = async (event) => {
  const headers = getCORSHeaders();

  // 1. CORS preflight
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  // 2. Rate limit (before any auth or DB work)
  const ip = getClientIP(event.headers);
  const rl = await checkRateLimit(db, ip, 'endpoint-name', 20, 900);
  if (rl.limited) return tooManyRequestsResponse(headers, 900);

  // 3. Auth
  const auth = verifyAuth(event.headers);
  if (!auth.valid) return errorResponse(headers, 401, 'Unauthorized');

  // 4. CSRF (POST/PUT/DELETE only)
  const csrf = validateCSRFToken(extractCSRFToken(event));
  if (!csrf.valid) return errorResponse(headers, 403, 'CSRF validation failed');

  // 5. Input validation — then business logic
};
```

## Environment Variables

- **Never** read a secret via `process.env.VITE_*` in a function — those are client-side prefixes.
- Required production vars: `ALLOWED_ORIGIN`, `JWT_SECRET`, `MONGODB_URI`, `R2_SECRET_ACCESS_KEY`, `R2_ACCESS_KEY_ID`.
- `getCORSHeaders()` must throw (not silently default) when `ALLOWED_ORIGIN` is unset.

## XSS / Output Encoding

When rendering user-supplied HTML on the client:
```typescript
import DOMPurify from 'dompurify';
// Always:
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userHtml) }} />
// Never:
<div dangerouslySetInnerHTML={{ __html: userHtml }} />
```

## Token Storage

- **Do not** store JWT tokens or session secrets in `localStorage` — XSS can steal them.
- Use HTTP-only `Secure SameSite=Strict` cookies set by the server, or at minimum `sessionStorage` with a short TTL.

## MongoDB Queries

Never build queries from string concatenation:
```typescript
// Bad
collection.findOne({ email: `${userInput}` })
// Good
collection.findOne({ email: sanitizedEmail })  // sanitizedEmail validated by inputValidation.ts
```

## File Uploads

- Validate MIME type server-side (not just `Content-Type` header — check magic bytes).
- Enforce max file size before streaming to R2.
- Generate presigned URLs server-side; never expose `R2_SECRET_ACCESS_KEY` to the client.
