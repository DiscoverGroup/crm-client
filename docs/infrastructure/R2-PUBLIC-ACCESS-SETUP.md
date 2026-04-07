# Cloudflare R2 Public Access Setup

## Problem
Files uploaded to R2 are not downloadable because the R2.dev subdomain is not accessible. This means public access is not enabled on your R2 bucket.

## Solution: Enable Public Access

### Step 1: Enable Public Access via Custom Domain

Cloudflare R2 requires you to connect a domain (or use R2.dev) to make files publicly accessible:

**Option A: Using R2.dev Subdomain (Easiest)**

1. Go to **Cloudflare Dashboard** (https://dash.cloudflare.com)
2. Navigate to **R2** → Select your **crm-uploads** bucket
3. Go to the **Settings** tab
4. Look for **Domain** or **Public URL** section
5. Click **Connect Domain** or **Allow Public Access**
6. Choose **Allow Access** (this will generate an R2.dev subdomain)
7. You'll get a public URL like: `https://pub-xxxxxxxxxxxxx.r2.dev`
8. **Copy this URL** - you'll need it for Step 2

**If you don't see the option:**

Some Cloudflare accounts might not show "R2.dev subdomain" directly. Instead:

1. In your bucket, look for **Domains** tab (not Settings)
2. Click **Connect Domain**
3. You should see an option to use **R2.dev subdomain** or connect a custom domain
4. Select R2.dev subdomain option
5. It will automatically generate: `https://pub-<random-hash>.r2.dev`

**Alternative: Quick Public Access**

1. In bucket overview, look for a **"Public"** toggle or **"Bucket Access"** dropdown
2. Change from "Private" to "Public"
3. This should generate the R2.dev URL automatically
4. Copy the provided URL

### Step 2: Update Netlify Environment Variables

1. Go to **Netlify Dashboard** → Your Site → **Site Configuration** → **Environment Variables**
2. Find `VITE_R2_PUBLIC_URL` (or add it if it doesn't exist)
3. Set the value to your R2.dev subdomain URL (from Step 1)
   - Example: `https://pub-39400cda7bb94c4fa451404e2759a6b8.r2.dev`
   - **NO trailing slash**
4. Click **Save**
5. **Redeploy** your site for changes to take effect

### Step 3: Update Local Environment (Optional)

If you're testing locally, also update your `.env.local`:

```env
VITE_R2_PUBLIC_URL=https://pub-xxxxxxxxxxxxx.r2.dev
```

Restart your dev server after updating.

## Alternative: Custom Domain (Production)

For production, you can use a custom domain instead of the R2.dev subdomain:

1. In R2 bucket settings, go to **Custom Domains**
2. Click **Connect Domain**
3. Add your domain (e.g., `files.yourdomain.com`)
4. Configure DNS as instructed by Cloudflare
5. Update `VITE_R2_PUBLIC_URL` to your custom domain

## Verify Setup

After enabling public access:

1. Upload a test file through your CRM
2. Check the console logs for the generated URL
3. Try opening the URL directly in a browser
4. The file should download/display properly

## Security Notes

- **R2.dev subdomain** = Public access (anyone with the URL can access)
- **No R2.dev subdomain** = Private (requires signed URLs or authentication)
- For sensitive files, consider using signed URLs instead of public access
- You can use folder-level permissions or bucket policies for finer control

## Troubleshooting

### "Can't connect to server" error
- Public access is not enabled → Follow Step 1 above
- Wrong URL in environment variables → Check and update in Netlify

### Files upload but can't download
- `VITE_R2_PUBLIC_URL` not set or incorrect
- R2.dev subdomain not enabled on bucket
- CORS not configured (if accessing from different domain)

### Already enabled public access but still not working?
1. Verify the R2.dev URL from Cloudflare dashboard matches your environment variable
2. Clear browser cache
3. Redeploy Netlify site after changing environment variables
4. Check browser console for actual URL being used
