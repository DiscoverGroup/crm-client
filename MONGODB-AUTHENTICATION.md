# MongoDB Server-Side Authentication

## Overview
The CRM now uses **MongoDB server-side authentication** instead of localStorage-only authentication. This means your login works across **all browsers and devices** - no more data isolation!

## What Changed

### Before (localStorage Only)
- ❌ Each browser had separate user data
- ❌ Login on Chrome mobile ≠ Login on Firefox desktop
- ❌ No cross-device/browser sync

### After (MongoDB + localStorage Hybrid)
- ✅ **Primary**: MongoDB Atlas stores all users centrally
- ✅ **Fallback**: localStorage for offline access
- ✅ Login works across ALL browsers and devices
- ✅ Auto-sync user data on login/registration

## New API Endpoints

### 1. Login API
**Endpoint:** `/.netlify/functions/login`

**Request:**
```json
POST /.netlify/functions/login
{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

**Response (Success):**
```json
{
  "success": true,
  "user": {
    "id": "...",
    "email": "user@example.com",
    "username": "username",
    "fullName": "User Name",
    "department": "IT",
    "position": "Developer",
    "isVerified": true
  },
  "message": "Login successful"
}
```

**Response (Failed):**
```json
{
  "success": false,
  "error": "Invalid email/username or password"
}
```

### 2. Registration API
**Endpoint:** `/.netlify/functions/register`

**Request:**
```json
POST /.netlify/functions/register
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123",
  "fullName": "John Doe",
  "department": "Sales",
  "position": "Manager",
  "profileImage": "optional_url"
}
```

**Response (Success):**
```json
{
  "success": true,
  "user": {
    "id": "...",
    "email": "john@example.com",
    "username": "johndoe",
    "fullName": "John Doe",
    "isVerified": false
  },
  "message": "Registration successful. Please verify your email.",
  "needsVerification": true
}
```

## How It Works

### Login Flow
1. User enters email and password
2. Frontend calls `/.netlify/functions/login` API
3. Backend checks MongoDB for user credentials
4. If found, user data synced to localStorage for offline access
5. User logged in successfully

### Registration Flow
1. User fills registration form
2. Frontend calls `/.netlify/functions/register` API
3. Backend creates user in MongoDB
4. User data synced to localStorage
5. Verification email sent
6. User must verify email before login

### Offline Mode
- If API fails (no internet), automatically falls back to localStorage
- Shows "(Offline mode)" in success message
- Syncs to MongoDB when connection restored

## Benefits

### Cross-Browser/Device Access
- Register on Chrome desktop → Login on Safari mobile ✅
- Register on Firefox → Login on Edge ✅
- All devices see the same accounts

### Data Persistence
- MongoDB is the **source of truth**
- localStorage is a **local cache**
- Data survives browser clearing (stored in MongoDB)

### Security Features
- Email verification required before login
- Password stored in MongoDB (should be hashed in production!)
- CORS headers configured for Netlify deployment

## Environment Setup

Make sure your Netlify environment has:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
```

The functions will automatically connect to your MongoDB Atlas cluster.

## Testing

### Test Cross-Browser Login
1. **Chrome:** Register new account `test@example.com`
2. **Firefox:** Login with `test@example.com` → ✅ Should work!
3. **Mobile Safari:** Login with `test@example.com` → ✅ Should work!

### Test Offline Fallback
1. Disconnect internet
2. Try to login with previously registered account
3. Should show "(Offline mode)" but still login ✅

## Migration Notes

### Existing Users
- Users already in localStorage will continue to work
- On first login after update, they'll be synced to MongoDB
- No data loss - backwards compatible!

### Admin Panel
- Admin users stored in MongoDB like regular users
- `role: 'admin'` field determines admin access
- Default new users get `role: 'user'`

## Future Enhancements

- [ ] Password hashing (bcrypt)
- [ ] JWT token authentication
- [ ] Session management
- [ ] Rate limiting on login attempts
- [ ] Password reset via email
- [ ] Two-factor authentication (2FA)

## Troubleshooting

### "MONGODB_URI not configured" Error
- Check Netlify environment variables
- Ensure MONGODB_URI is set and not localhost

### Login Works on Desktop but Not Mobile
- This is now FIXED! MongoDB solves cross-browser issues
- Both should work identically now

### User Not Found After Registration
- Check MongoDB Atlas to confirm user was created
- Verify MONGODB_URI is correct
- Check Network tab for API response

## Files Modified

- `netlify/functions/login.ts` - New login API
- `netlify/functions/register.ts` - New registration API
- `src/App.tsx` - Updated handleLogin and handleRegister
- Both functions include localStorage fallback for offline mode

---

**Status:** ✅ Deployed and Working
**Last Updated:** February 10, 2026
