# Cloudflare R2 Setup Guide

## Overview
Cloudflare R2 is an object storage solution that's compatible with the S3 API. It offers generous free tier and no egress charges, making it ideal for file uploads in CRM applications.

## Benefits of R2
- **No Egress Fees** - Unlike AWS S3, you don't pay for data downloads
- **S3-Compatible API** - Uses standard AWS SDK
- **Free Tier** - Generous free storage and request allowances
- **Global CDN** - Integrated with Cloudflare's global network
- **Simple Pricing** - Straightforward per-request and storage pricing

## Setup Steps

### 1. Get Your Cloudflare Account ID
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Go to Account Settings (bottom left)
3. Copy your **Account ID** from the right sidebar

### 2. Create an R2 API Token
1. In Cloudflare Dashboard, go to **R2**
2. Click **Create bucket** (or use existing bucket)
3. Go to **Settings > API Tokens**
4. Click **Create API Token**
5. Name it (e.g., "CRM Upload Token")
6. Grant **Object Read & Write** permissions
7. Restrict to your R2 bucket
8. Copy the **Access Key ID** and **Secret Access Key**

### 3. Create an R2 Bucket
1. In R2 section, click **Create bucket**
2. Name it (e.g., `crm-uploads`, `payment-docs`)
3. Choose region (closest to your users)
4. Keep defaults for other settings
5. Click **Create bucket**

### 4. Configure Environment Variables
1. Copy `.env.r2.example` to `.env.local`:
   ```bash
   cp .env.r2.example .env.local
   ```

2. Fill in the values:
   ```
   VITE_R2_ACCOUNT_ID=your-account-id
   VITE_R2_ACCESS_KEY_ID=your-access-key-id
   VITE_R2_SECRET_ACCESS_KEY=your-secret-access-key
   VITE_R2_BUCKET_NAME=your-bucket-name
   ```

3. Restart your development server for changes to take effect

## Usage

### Basic File Upload
```typescript
import { uploadFileToR2 } from '@/services/r2UploadService';

const result = await uploadFileToR2(file, 'crm-uploads', 'invoices');

if (result.success) {
  console.log('File uploaded:', result.url);
} else {
  console.error('Upload failed:', result.error);
}
```

### Using the R2FileUploadComponent
```typescript
import R2FileUploadComponent from '@/components/R2FileUploadComponent';

<R2FileUploadComponent
  bucket="crm-uploads"
  folder="payment-proofs"
  accept=".pdf,.jpg,.png"
  maxSize={100 * 1024 * 1024} // 100MB
  onUploadSuccess={(path, url) => {
    console.log('File uploaded to:', url);
  }}
  onUploadError={(error) => {
    console.error('Upload error:', error);
  }}
  label="Upload Payment Receipt"
/>
```

### In Payment Form
```typescript
import R2FileUploadComponent from '@/components/R2FileUploadComponent';

// Upload deposit slip
<R2FileUploadComponent
  bucket="crm-uploads"
  folder="deposit-slips"
  accept=".pdf,.jpg,.jpeg,.png"
  onUploadSuccess={(path, url) => {
    setPaymentData({...paymentData, depositSlipUrl: url});
  }}
  label="Upload Deposit Slip"
/>

// Upload receipt
<R2FileUploadComponent
  bucket="crm-uploads"
  folder="receipts"
  accept=".pdf,.jpg,.jpeg,.png"
  onUploadSuccess={(path, url) => {
    setPaymentData({...paymentData, receiptUrl: url});
  }}
  label="Upload Receipt"
/>
```

## Available Services

### uploadFileToR2()
```typescript
uploadFileToR2(file: File, bucket: string, folder?: string): Promise<UploadResponse>
```
Uploads a file to R2 bucket and returns the public URL.

### deleteFileFromR2()
```typescript
deleteFileFromR2(bucket: string, filePath: string): Promise<UploadResponse>
```
Deletes a file from R2 bucket.

### getR2FileUrl()
```typescript
getR2FileUrl(filePath: string): string
```
Gets the public URL for a stored file.

## Configuration Details

### Account ID
- Found in Cloudflare Dashboard > Account Settings
- Format: Usually a long alphanumeric string
- Used to construct R2 endpoint URL

### API Token Permissions
- **Object Read** - Allow downloads/viewing
- **Object Write** - Allow uploads/modifications
- **Object Delete** - Allow file deletion
- Scope: Limit to specific bucket for security

### Bucket Configuration
- **Region**: Choose closest to your users for best performance
- **Object Lock**: Optional, for compliance/archive
- **Versioning**: Optional, for backup/recovery

## Security Best Practices

1. **Limit API Token Scope** - Create tokens for specific buckets
2. **Set Expiration** - Add expiration dates to API tokens
3. **Use Least Privilege** - Only grant needed permissions
4. **Never Commit Credentials** - Keep `.env.local` in `.gitignore`
5. **Monitor Usage** - Check Cloudflare dashboard for unusual activity

## R2 Pricing (as of 2026)
- **Storage**: $0.015/GB/month
- **Class A requests** (write): $4.50 per million requests
- **Class B requests** (read): $0.36 per million requests
- **Free tier**: 10GB storage + generous free requests

## File Structure
```
src/
├── config/
│   └── r2.ts                      # R2 client configuration
├── services/
│   └── r2UploadService.ts         # Upload/delete/URL utilities
└── components/
    └── R2FileUploadComponent.tsx   # Reusable upload component
```

## Troubleshooting

### "No credentials configured"
- Verify all R2 credentials are in `.env.local`
- Restart dev server after adding env variables
- Check environment variable names are spelled correctly

### "Access Denied" errors
- Confirm API token has correct permissions
- Verify token is scoped to the right bucket
- Check if token has expired

### "Bucket not found"
- Verify bucket name is correct (case-sensitive)
- Ensure bucket exists in R2
- Check bucket name in code matches env variable

### CORS Issues
- R2 supports CORS, configure in bucket settings if needed
- For browser uploads, may need to set CORS headers

## Additional Resources
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [AWS SDK for JavaScript](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/)
- [R2 API Reference](https://developers.cloudflare.com/r2/api/s3/api/)
