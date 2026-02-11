# Admin Account Credentials - TEMPLATE

This is a **template file** showing the format for admin credentials. This file is safe to commit to version control.

**Do NOT include actual credentials in this file.**

## Admin Login Credentials Format

```
Email: admin@discovergrp.com
Password: [A strong password with mixed case, numbers, and special characters]
```

## How to Set Admin Credentials

### For Local Development
1. Create a local `.env` file (in root directory)
2. Add your development admin password (this file is in .gitignore)
3. Update the registration/admin creation function with the desired credentials

### For Production (Netlify)
1. Login to your Netlify dashboard
2. Go to **Site Settings** → **Build & Deploy** → **Environment**
3. Add variable: `ADMIN_PASSWORD` with your secure password
4. Add variable: `ADMIN_EMAIL` with `admin@discovergrp.com` (or your choice)
5. Redeploy your site

## Security Requirements

Your admin password should:
- ✅ Be at least 8 characters long
- ✅ Contain uppercase letters (A-Z)
- ✅ Contain lowercase letters (a-z)
- ✅ Contain numbers (0-9)
- ✅ Contain special characters (!@#$%^&*)
- ❌ NOT be the same as any user password
- ❌ NOT contain dictionary words

## Example (DO NOT USE IN PRODUCTION)
```
admin@discovergrp.com : SecurePass123!@#
```

## Important Reminders

⚠️ **NEVER commit `ADMIN-CREDENTIALS.md` with actual credentials**  
⚠️ **NEVER hardcode passwords in source files**  
⚠️ **ALWAYS use environment variables for sensitive data**  
⚠️ **ALWAYS add credential files to `.gitignore`**  
⚠️ **ROTATE credentials after suspected exposure**  
