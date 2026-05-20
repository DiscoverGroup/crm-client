# Sliding Session Implementation (Token Auto-Refresh)

## Problem Solved

Users were being logged out after 1 hour of continuous use, causing:
- Lost work and interrupted workflows
- Frustration from unexpected logouts
- 401 errors during active sessions
- Poor user experience

## Solution: Sliding Sessions

Implemented automatic token refresh that keeps users logged in indefinitely as long as they're actively using the app.

## How It Works

### 1. Token Lifecycle

```
User logs in
  ↓
JWT issued (expires in 1 hour)
  ↓
User continues working...
  ↓
50 minutes pass (token expires in 10 min)
  ↓
Auto-refresh triggered
  ↓
New JWT issued (fresh 1 hour expiry)
  ↓
User continues working seamlessly
  ↓
(Repeat every ~50 minutes)
```

### 2. Three-Layer Protection

**Layer 1: Periodic Check (Every 5 Minutes)**
- Background timer checks token expiry
- Refreshes if <10 minutes remaining
- Runs while user is logged in

**Layer 2: Pre-Request Refresh**
- `authHeadersWithRefresh()` checks before critical API calls
- Ensures token is fresh before important operations
- Prevents mid-request expiry

**Layer 3: Fallback on 401**
- If refresh fails or token truly expires
- User is logged out gracefully
- Clear modal explains what happened

## Implementation Details

### Server-Side: Token Refresh Endpoint

**File:** `netlify/functions/refresh-token.ts`

**Features:**
- Validates current JWT (must still be valid)
- Issues new JWT with fresh 1h expiry
- Verifies user still exists and is approved
- Rate limited: 10 refreshes per user per minute
- Returns new token + expiry time

**Security:**
- Only accepts valid (not expired) tokens
- Checks user approval status
- Prevents token refresh for rejected/pending users
- Rate limiting prevents abuse

### Client-Side: Automatic Refresh

**File:** `src/utils/authToken.ts`

**New Functions:**

1. **`shouldRefreshToken(token)`**
   - Returns true if token expires in <10 minutes
   - Gives 10-minute buffer for refresh

2. **`refreshAuthToken()`**
   - Calls `/refresh-token` endpoint
   - Updates localStorage with new token
   - Triggers logout on failure

3. **`authHeadersWithRefresh()`**
   - Async version of `authHeaders()`
   - Refreshes token if needed before returning headers
   - Use for critical operations

**File:** `src/App.tsx`

**Auto-Refresh Timer:**
- Checks every 5 minutes while logged in
- Refreshes token if <10 minutes remaining
- Logs refresh status to console
- Silent operation (no user interruption)

## User Experience

### Before (Without Sliding Sessions)
```
User logs in at 9:00 AM
  ↓
Works continuously
  ↓
10:00 AM - Token expires
  ↓
Next action: 401 error
  ↓
"Session expired" modal
  ↓
User must log in again
  ↓
Lost context, interrupted workflow
```

### After (With Sliding Sessions)
```
User logs in at 9:00 AM
  ↓
Works continuously
  ↓
9:50 AM - Token auto-refreshed (silent)
  ↓
10:40 AM - Token auto-refreshed (silent)
  ↓
11:30 AM - Token auto-refreshed (silent)
  ↓
User works all day without interruption
  ↓
User closes browser or logs out manually
```

## Configuration

### Token Expiry Settings

**Current:** 1 hour per token
**Location:** `netlify/functions/middleware/authMiddleware.ts`

```typescript
expiresIn: '1h'  // Can be adjusted if needed
```

**Refresh Trigger:** 10 minutes before expiry
**Location:** `src/utils/authToken.ts`

```typescript
const tenMinutes = 10 * 60 * 1000;
return (expiresAt - now) < tenMinutes;
```

**Check Interval:** Every 5 minutes
**Location:** `src/App.tsx`

```typescript
const refreshInterval = setInterval(checkAndRefreshToken, 5 * 60 * 1000);
```

### Adjusting Timings

**To change token lifetime:**
```typescript
// netlify/functions/middleware/authMiddleware.ts
expiresIn: '2h'  // 2 hours instead of 1
```

**To change refresh trigger:**
```typescript
// src/utils/authToken.ts
const fifteenMinutes = 15 * 60 * 1000;  // Refresh at 15min remaining
```

**To change check frequency:**
```typescript
// src/App.tsx
const refreshInterval = setInterval(checkAndRefreshToken, 3 * 60 * 1000);  // Every 3 minutes
```

## Rate Limiting

**Endpoint:** `POST /.netlify/functions/refresh-token`
**Limit:** 10 requests per user per minute

This prevents:
- Accidental refresh loops
- Malicious token farming
- Server resource exhaustion

Normal usage: ~1 refresh per 50 minutes = well under limit

## Security Considerations

### What This Protects Against

✅ **Session timeout during active use**
- Users stay logged in while working
- No interruption to workflow

✅ **Token expiry mid-request**
- 10-minute buffer prevents edge cases
- Pre-request refresh for critical ops

✅ **Abuse via excessive refreshes**
- Rate limiting prevents token farming
- 10 refreshes/min is generous but safe

### What This Does NOT Protect Against

❌ **XSS attacks stealing tokens**
- Tokens still in localStorage (see M1 in AGENTS.md)
- Future: Move to HTTP-only cookies

❌ **Compromised tokens**
- Refresh extends compromised token lifetime
- Future: Add token revocation list

❌ **Inactive sessions**
- User leaves browser open overnight
- Token keeps refreshing even when idle
- Future: Add activity tracking

## Testing

### Manual Testing

1. **Normal Refresh Flow**
   ```
   1. Log in to the app
   2. Open browser console
   3. Wait 50+ minutes (or manually set token expiry)
   4. Watch for: "[Auth] Token expiring soon, refreshing..."
   5. Verify: "[Auth] Token refreshed successfully"
   6. Confirm: No logout, no interruption
   ```

2. **Refresh Failure Handling**
   ```
   1. Log in to the app
   2. Stop the Netlify dev server
   3. Wait for refresh attempt
   4. Verify: User is logged out gracefully
   5. Verify: "Session expired" modal appears
   ```

3. **Rate Limit Testing**
   ```
   1. Log in to the app
   2. Open browser console
   3. Run: for(let i=0; i<15; i++) { await refreshAuthToken(); }
   4. Verify: First 10 succeed, rest return 429
   ```

### Automated Testing

```typescript
// Test token refresh logic
describe('Token Refresh', () => {
  it('should refresh token when <10 min remaining', () => {
    const token = createTokenExpiringIn(9 * 60 * 1000); // 9 minutes
    expect(shouldRefreshToken(token)).toBe(true);
  });

  it('should not refresh token when >10 min remaining', () => {
    const token = createTokenExpiringIn(15 * 60 * 1000); // 15 minutes
    expect(shouldRefreshToken(token)).toBe(false);
  });

  it('should handle refresh failure gracefully', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    const result = await refreshAuthToken();
    expect(result).toBeNull();
    expect(getAuthToken()).toBeNull(); // Token cleared
  });
});
```

## Monitoring

### Client-Side Logs

```javascript
// Success
[Auth] Token expiring soon, refreshing...
[Auth] Token refreshed successfully

// Failure
[Auth] Token expiring soon, refreshing...
[Auth] Token refresh failed
```

### Server-Side Logs

```javascript
// Rate limit hit
[refresh-token] Rate limit exceeded for user: abc123

// User not found
[refresh-token] User not found: abc123

// Success (no log by default, add if needed)
```

## Future Enhancements

### 1. Activity-Based Refresh
Only refresh if user has been active in the last 30 minutes:
```typescript
let lastActivityTime = Date.now();
window.addEventListener('mousemove', () => lastActivityTime = Date.now());
window.addEventListener('keydown', () => lastActivityTime = Date.now());

// In refresh check:
const inactiveTime = Date.now() - lastActivityTime;
if (inactiveTime > 30 * 60 * 1000) {
  // Don't refresh, let token expire
}
```

### 2. HTTP-Only Refresh Tokens
Move to secure cookie-based refresh tokens:
```typescript
// Server sets HTTP-only cookie
res.setHeader('Set-Cookie', `refresh_token=${token}; HttpOnly; Secure; SameSite=Strict`);

// Client can't access it (XSS protection)
// Server reads it automatically on refresh
```

### 3. Token Revocation
Add ability to invalidate tokens server-side:
```typescript
// Store active tokens in Redis/MongoDB
// Check on each refresh if token is revoked
// Useful for: logout all devices, security incidents
```

## Files Modified

- ✅ `netlify/functions/refresh-token.ts` - New endpoint
- ✅ `src/utils/authToken.ts` - Refresh logic
- ✅ `src/App.tsx` - Auto-refresh timer
- ✅ `docs/security/SLIDING-SESSION-IMPLEMENTATION.md` - This doc

## Related Documentation

- `docs/security/TOKEN-EXPIRY-FIX.md` - Initial expiry detection
- `AGENTS.md` - Security issues M1 (localStorage) and M2 (token expiry)
- `netlify/functions/middleware/authMiddleware.ts` - JWT generation/validation

## Rollback Plan

If issues arise, disable auto-refresh:

```typescript
// src/App.tsx - Comment out the auto-refresh effect
/*
useEffect(() => {
  if (!isLoggedIn) return;
  const checkAndRefreshToken = async () => { ... };
  const refreshInterval = setInterval(checkAndRefreshToken, 5 * 60 * 1000);
  return () => clearInterval(refreshInterval);
}, [isLoggedIn]);
*/
```

Users will revert to 1-hour sessions with graceful logout on expiry.
