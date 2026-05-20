# JWT Token Expiry Detection & Auto-Logout Fix

## Problem

Users were experiencing 401 (Unauthorized) errors after being logged in for more than 1 hour because:

1. JWT tokens expire after 1 hour (configured in `authMiddleware.ts`)
2. No automatic token expiry detection existed
3. No token refresh mechanism was implemented
4. Users weren't notified when their session expired

## Solution Implemented

### 1. Token Expiry Detection (`src/utils/authToken.ts`)

Added `isTokenExpired()` function that:
- Decodes the JWT payload without verification
- Checks the `exp` (expiration) claim
- Adds a 5-minute buffer to prevent mid-request expiry
- Automatically clears expired tokens from localStorage

```typescript
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false;
    
    // Check if token expires in the next 5 minutes (300 seconds)
    return Date.now() >= (payload.exp * 1000) - (5 * 60 * 1000);
  } catch {
    return true;
  }
}
```

### 2. Auto-Logout on Token Expiry

Modified `recordAuthFailure()` to:
- Clear the auth token on 401 errors
- Dispatch a custom `auth:expired` event
- Trigger automatic logout

```typescript
if (status === 401) {
  clearAuthToken();
  window.dispatchEvent(new CustomEvent('auth:expired'));
}
```

### 3. User Notification (`src/App.tsx`)

Added event listener in App.tsx that:
- Listens for `auth:expired` events
- Logs the user out
- Shows a modal: "Your session has expired. Please log in again."

## User Experience

**Before:**
- Silent 401 errors in console
- App appears broken
- No indication why features stopped working

**After:**
- Expired tokens are detected immediately
- User is automatically logged out
- Clear modal message explains what happened
- User can log back in with one click

## Token Lifecycle

```
Login → JWT issued (1h expiry)
  ↓
55 minutes pass
  ↓
Token still valid (5min buffer remaining)
  ↓
60 minutes pass
  ↓
Token detected as expired
  ↓
Next API call returns 401
  ↓
recordAuthFailure() triggered
  ↓
Token cleared + auth:expired event
  ↓
User logged out + modal shown
```

## Future Improvements (Not Implemented Yet)

These are documented in `AGENTS.md` as issue **M2**:

1. **Refresh Token Flow**
   - Issue short-lived access tokens (15-30 min)
   - Issue long-lived refresh tokens (7 days, HTTP-only cookie)
   - Auto-refresh access token before expiry
   - Seamless user experience (no forced logout)

2. **Token Renewal Endpoint**
   - `POST /.netlify/functions/refresh-token`
   - Validates refresh token
   - Issues new access token
   - Rotates refresh token (security best practice)

3. **Proactive Renewal**
   - Check token expiry every 5 minutes
   - Renew when <10 minutes remaining
   - Prevents mid-session interruptions

## Testing

To test the fix:

1. Log in to the app
2. Wait 1 hour (or manually expire the token in localStorage)
3. Try to perform any action (send message, load clients, etc.)
4. Verify:
   - ✅ Modal appears: "Your session has expired"
   - ✅ User is logged out
   - ✅ Login screen is shown
   - ✅ No console errors after logout

## Files Modified

- `src/utils/authToken.ts` - Added token expiry detection
- `src/App.tsx` - Added auth:expired event listener
- `docs/security/TOKEN-EXPIRY-FIX.md` - This documentation

## Related Issues

- **AGENTS.md M2**: JWT expiry set to 24 hours (now 1h, refresh tokens not yet implemented)
- **AGENTS.md M1**: JWT tokens stored in localStorage (XSS risk, should use HTTP-only cookies)

## Security Notes

- Token expiry detection happens client-side (convenience, not security)
- Server-side validation in `authMiddleware.ts` is the security boundary
- Expired tokens are rejected by the server regardless of client checks
- Client-side detection improves UX by catching expiry before API calls
