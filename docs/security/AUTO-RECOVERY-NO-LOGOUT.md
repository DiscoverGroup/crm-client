# Automatic Session Recovery (No Logout Required)

## Problem Solved

Users with expired tokens had to manually log out and log back in to get a fresh token. This was frustrating because:
- They had to remember their password
- They lost their current page/context
- It interrupted their workflow
- It happened even if they just closed the browser for a few minutes

## Solution: Automatic Token Recovery

The app now **automatically recovers expired sessions** without requiring logout:

### 1. On Page Load/Refresh
```
User closes browser with expired token
  ↓
User reopens browser (token expired 3 minutes ago)
  ↓
App detects expired token
  ↓
App calls refresh-token endpoint
  ↓
Server accepts token (within 5-min grace period)
  ↓
New token issued
  ↓
User is logged in automatically - NO LOGOUT NEEDED!
```

### 2. Grace Period for Expired Tokens

The refresh endpoint accepts tokens that expired **within the last 5 minutes**:

```
Token expires at 10:00 AM
  ↓
User returns at 10:03 AM (3 min after expiry)
  ↓
✅ Token refresh succeeds (within grace period)
  ↓
User stays logged in

vs.

Token expires at 10:00 AM
  ↓
User returns at 10:10 AM (10 min after expiry)
  ↓
❌ Token refresh fails (beyond grace period)
  ↓
User must log in again
```

## How It Works

### Client-Side (App.tsx)

**On Page Load:**
1. Check if user has saved auth state
2. Check if JWT token exists
3. **If token is expired:**
   - Attempt automatic refresh
   - If successful: restore session
   - If failed: clear session (user must log in)
4. **If token is valid but expiring soon (<10 min):**
   - Restore session immediately
   - Refresh token proactively in background

**Code:**
```typescript
const initializeAuth = async () => {
  const savedAuth = localStorage.getItem('crm_auth');
  const token = getAuthToken();
  
  // If token is expired, try to refresh it
  if (authData.isLoggedIn && !jwtValid && token) {
    console.log('[Auth] Token expired on page load, attempting refresh...');
    const newToken = await refreshAuthToken();
    if (newToken) {
      console.log('[Auth] Token refreshed successfully on page load');
      setIsLoggedIn(true);
      setCurrentUser(authData.currentUser);
      return; // Session recovered!
    }
  }
  
  // ... rest of logic
};
```

### Server-Side (refresh-token.ts)

**Grace Period Logic:**
```typescript
// If token is expired, check if it's within grace period
if (auth.error === 'Token has expired') {
  const payload = decodeToken(token);
  const expiredAt = payload.exp * 1000;
  const now = Date.now();
  const gracePeriodMs = 5 * 60 * 1000; // 5 minutes
  
  if (now - expiredAt > gracePeriodMs) {
    return unauthorizedResponse(headers, 'Token expired beyond grace period');
  }
  
  // Within grace period - allow refresh!
}
```

## User Experience Scenarios

### Scenario 1: Quick Browser Restart
```
10:00 AM - User working (token valid until 11:00 AM)
10:30 AM - User closes browser
10:35 AM - User reopens browser
Result: ✅ Logged in automatically (token still valid)
```

### Scenario 2: Short Break (Within Grace Period)
```
10:00 AM - User working (token valid until 11:00 AM)
10:55 AM - User closes browser
11:03 AM - User reopens browser (token expired 3 min ago)
Result: ✅ Logged in automatically (within 5-min grace period)
```

### Scenario 3: Long Break (Beyond Grace Period)
```
10:00 AM - User working (token valid until 11:00 AM)
10:55 AM - User closes browser
11:30 AM - User reopens browser (token expired 30 min ago)
Result: ❌ Must log in again (beyond grace period)
```

### Scenario 4: Continuous Use (4+ Hours)
```
9:00 AM - User logs in
9:50 AM - Token auto-refreshed (background)
10:40 AM - Token auto-refreshed (background)
11:30 AM - Token auto-refreshed (background)
12:20 PM - Token auto-refreshed (background)
1:10 PM - Token auto-refreshed (background)
Result: ✅ User works all day without interruption
```

## Configuration

### Grace Period Duration

**Current:** 5 minutes
**Location:** `netlify/functions/refresh-token.ts`

```typescript
const gracePeriodMs = 5 * 60 * 1000; // 5 minutes
```

**To adjust:**
```typescript
const gracePeriodMs = 10 * 60 * 1000; // 10 minutes (more forgiving)
const gracePeriodMs = 2 * 60 * 1000;  // 2 minutes (more strict)
```

### Token Lifetime

**Current:** 1 hour per token
**Location:** `netlify/functions/middleware/authMiddleware.ts`

```typescript
expiresIn: '1h'
```

### Auto-Refresh Trigger

**Current:** Refresh when <10 minutes remaining
**Location:** `src/utils/authToken.ts`

```typescript
const tenMinutes = 10 * 60 * 1000;
return (expiresAt - now) < tenMinutes;
```

## Security Considerations

### Why 5-Minute Grace Period?

**Too Short (1-2 minutes):**
- Users who close browser and reopen quickly still get logged out
- Defeats the purpose of auto-recovery

**Too Long (30+ minutes):**
- Compromised tokens have longer window of abuse
- Violates principle of short-lived tokens

**5 Minutes (Sweet Spot):**
- Covers most "quick browser restart" scenarios
- Covers "stepped away for coffee" scenarios
- Still maintains reasonable security posture
- Compromised token has limited extended lifetime

### Security Trade-offs

✅ **Benefits:**
- Better user experience
- Fewer password re-entries (reduces phishing risk)
- Fewer support tickets
- Users less likely to use weak passwords

⚠️ **Risks:**
- Compromised token has 5 extra minutes of validity
- Attacker could refresh stolen token within grace period

**Mitigation:**
- Grace period is short (5 min)
- Rate limiting prevents token farming
- User approval status checked on every refresh
- Future: Add device fingerprinting, IP validation

## Monitoring

### Client-Side Console Logs

```javascript
// Successful recovery
[Auth] Token expired on page load, attempting refresh...
[Auth] Token refreshed successfully on page load

// Failed recovery
[Auth] Token expired on page load, attempting refresh...
[Auth] Token refresh failed

// Proactive refresh
[Auth] Token expiring soon, refreshing proactively...
[Auth] Token refreshed proactively
```

### Server-Side Logs

Add these to `refresh-token.ts` if needed:

```typescript
// Grace period acceptance
console.log(`[refresh-token] Accepted expired token within grace period for user: ${userId}`);

// Grace period rejection
console.log(`[refresh-token] Rejected expired token beyond grace period for user: ${userId}`);
```

## Testing

### Test 1: Expired Token Recovery
```bash
1. Log in to the app
2. Open browser DevTools → Application → Local Storage
3. Find 'crm_jwt_token'
4. Decode the JWT (jwt.io)
5. Note the 'exp' timestamp
6. Wait for token to expire (or manually edit exp to past time)
7. Refresh the page
8. Expected: Logged in automatically (if within 5 min grace period)
```

### Test 2: Grace Period Boundary
```bash
1. Log in to the app
2. Manually set token exp to 6 minutes ago
3. Refresh the page
4. Expected: Logged out (beyond grace period)
```

### Test 3: Valid Token Proactive Refresh
```bash
1. Log in to the app
2. Manually set token exp to 8 minutes from now
3. Refresh the page
4. Expected: Logged in + proactive refresh in background
5. Check console: "[Auth] Token expiring soon, refreshing proactively..."
```

## Comparison: Before vs After

### Before This Fix

| Scenario | Experience |
|----------|------------|
| Close browser for 2 min | ✅ Still logged in |
| Close browser for 65 min | ❌ Must log out & log in |
| Work for 4 hours straight | ❌ Logged out after 1 hour |
| Token expires mid-session | ❌ 401 errors, must log out |

### After This Fix

| Scenario | Experience |
|----------|------------|
| Close browser for 2 min | ✅ Still logged in (token valid) |
| Close browser for 65 min (3 min after expiry) | ✅ Auto-recovered (grace period) |
| Close browser for 70 min (10 min after expiry) | ❌ Must log in (beyond grace) |
| Work for 4 hours straight | ✅ Auto-refreshed every 50 min |
| Token expires mid-session | ✅ Auto-refreshed before expiry |

## Future Enhancements

### 1. Extend Grace Period with Device Trust
```typescript
// Trusted devices get 30-min grace period
// Untrusted devices get 5-min grace period
const gracePeriod = isTrustedDevice(userId, deviceId) 
  ? 30 * 60 * 1000 
  : 5 * 60 * 1000;
```

### 2. Activity-Based Grace Period
```typescript
// If user was active recently, extend grace period
const lastActivity = getLastActivityTime(userId);
const timeSinceActivity = now - lastActivity;

if (timeSinceActivity < 10 * 60 * 1000) {
  // Active within last 10 min → 15 min grace period
  gracePeriod = 15 * 60 * 1000;
} else {
  // Inactive → 5 min grace period
  gracePeriod = 5 * 60 * 1000;
}
```

### 3. IP/Location Validation
```typescript
// Only allow refresh from same IP/location as original login
const loginIP = getLoginIP(userId);
const currentIP = getRequestIP(event);

if (loginIP !== currentIP) {
  return unauthorizedResponse(headers, 'IP mismatch - please log in again');
}
```

## Files Modified

- ✅ `src/App.tsx` - Auto-recovery on page load
- ✅ `src/utils/authToken.ts` - Bypass expiry check for refresh
- ✅ `netlify/functions/refresh-token.ts` - Grace period logic
- ✅ `docs/security/AUTO-RECOVERY-NO-LOGOUT.md` - This doc

## Related Documentation

- `docs/security/SLIDING-SESSION-IMPLEMENTATION.md` - Auto-refresh during active use
- `docs/security/TOKEN-EXPIRY-FIX.md` - Initial expiry detection
- `AGENTS.md` - Security issues M1 and M2

## Summary

Users no longer need to log out and log back in when their token expires. The app automatically recovers expired sessions within a 5-minute grace period, providing a seamless experience while maintaining reasonable security.

**Key Benefits:**
- ✅ No manual logout required
- ✅ Works for quick browser restarts
- ✅ Works for short breaks (coffee, lunch)
- ✅ Combined with auto-refresh: unlimited session for active users
- ✅ Graceful fallback for long absences
