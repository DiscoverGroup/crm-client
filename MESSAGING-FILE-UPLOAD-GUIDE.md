# Messaging Center - New Features Documentation

## 📱 **Emoji Picker with Categories**

The emoji picker now features organized categories for better user experience:

### Categories Available:
1. **😊 Smileys** - All facial expressions and emotions (32 emojis)
2. **👋 Gestures** - Hand gestures and body parts (31 emojis)
3. **❤️ Hearts** - Various heart emojis and love symbols (21 emojis)
4. **🐶 Animals** - Animals, birds, and nature (32 emojis)
5. **🍕 Food** - Food and beverages (32 emojis)
6. **⚽ Activities** - Sports and activities (32 emojis)
7. **✈️ Travel** - Vehicles and travel (32 emojis)
8. **💼 Objects** - Technology and objects (32 emojis)

### Features:
- **Category Tabs**: Click on category icons to switch between emoji groups
- **Active Category Highlighting**: Selected category is highlighted in blue
- **Hover Effects**: Emojis scale up on hover for better visibility
- **Auto-close**: Picker closes automatically after selecting an emoji
- **Scrollable**: Category tabs are horizontally scrollable if needed
- **200+ Emojis**: Total of 212 emojis across all categories

### Usage:
1. Click the 😊 button in the message input area
2. Click on a category tab to view emojis in that category
3. Click any emoji to insert it into your message
4. Click outside or press ESC to close the picker

---

## 📎 **File Attachments with Cloudflare R2**

File attachments are now uploaded to Cloudflare R2 with permanent public URLs.

### Features:

#### Upload Process:
1. **Click 📎 button** to select a file
2. **Preview** for images before sending
3. **File info** shows name and size
4. **R2 Upload** happens automatically when you send
5. **Permanent URLs** - files are publicly accessible via permanent links

#### Supported File Types:
- **Images**: JPG, JPEG, PNG, GIF, WEBP, BMP
- **Documents**: PDF, DOC, DOCX

#### File Display:
- **Images**: Display inline with click-to-enlarge
- **Documents**: Show as downloadable cards with:
  - File icon 📎
  - File name
  - "Click to download" text
  - Download icon ⬇️

#### Technical Details:
- **Storage**: Cloudflare R2 bucket `crm-uploads`
- **Folder Structure**: Files stored in `messages/` folder
- **Naming**: Timestamped filenames (e.g., `1738754321-document.pdf`)
- **URL Format**: `https://pub-{account}.r2.dev/messages/{timestamp}-{filename}`
- **No Expiry**: Public URLs never expire
- **Max Size**: Depends on R2 configuration (typically 5GB per file)

#### Security:
- Public read access via R2 public URL
- Files are permanently accessible via direct URL
- No authentication required for downloads

### Message Format:
Messages with attachments use this format:
```
📎 [filename.ext](https://pub-xxxxx.r2.dev/messages/timestamp-filename.ext)
Optional text message here
```

### Environment Variables Required:
```env
VITE_R2_ACCOUNT_ID=your_account_id
VITE_R2_ACCESS_KEY_ID=your_access_key
VITE_R2_SECRET_ACCESS_KEY=your_secret_key
VITE_R2_BUCKET_NAME=crm-uploads
VITE_R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

---

## 🎨 **UI Improvements**

### Emoji Picker:
- **Width**: 360px (wider to accommodate categories)
- **Max Height**: 320px
- **Better Shadows**: Enhanced depth perception
- **Category Navigation**: Intuitive tab-based navigation
- **Larger Emojis**: 28px for better visibility

### File Attachments:
- **Image Preview**: Full-width images in messages
- **Download Cards**: Professional-looking file cards
- **Hover Effects**: Visual feedback on interaction
- **Loading Indicator**: ⏳ shown during upload

### Upload Status:
- **Uploading State**: Send button shows ⏳ during upload
- **Disabled State**: Button disabled while uploading
- **Error Handling**: Alert shown if upload fails

---

## 📝 **Usage Examples**

### Sending a Message with Image:
1. Click 📎 button
2. Select image file
3. Preview appears showing the image
4. Type optional message text
5. Click Send (➤)
6. File uploads to R2 automatically
7. Recipient sees image displayed inline

### Sending a Message with Document:
1. Click 📎 button
2. Select PDF/DOC file
3. File info card appears
4. Type optional message text
5. Click Send (➤)
6. File uploads to R2
7. Recipient sees download card with link

### Using Emojis:
1. Click 😊 button in input
2. Click "🍕 Food" category tab
3. Click pizza emoji 🍕
4. Emoji inserted into message
5. Continue typing or send

---

## 🔧 **Technical Implementation**

### File Upload Flow:
```javascript
1. User selects file → handleFileSelect()
2. Create local preview (images only)
3. User clicks send → handleSendMessage()
4. uploadFileToR2() uploads to Cloudflare R2
5. Get permanent public URL
6. Format message with file link
7. Send message with formatted content
8. Clear attachment and preview
```

### Message Rendering:
```javascript
1. Message received with file link
2. renderMessageContent() parses message
3. Detect file attachment pattern: 📎 [name](url)
4. Check if image or document
5. Render appropriate component:
   - Image: <img> with click handler
   - Document: Download card with link
6. Display remaining message text
```

### R2 Configuration:
- **Client**: AWS SDK S3Client with R2 endpoint
- **Bucket**: Public read access configured
- **CORS**: Enabled for browser uploads
- **Public Access**: Enabled via custom domain/public URL

---

## 🚀 **Benefits**

1. **Permanent Links**: Files never expire, always accessible
2. **No Signatures**: Simple public URLs, no complex auth
3. **Fast Access**: Cloudflare's global CDN for quick downloads
4. **Scalable**: R2 handles unlimited storage
5. **Cost-Effective**: No egress fees
6. **Better UX**: Inline image display, easy downloads
7. **Professional**: Clean, modern file attachment UI

---

## 🐛 **Error Handling**

- **Upload Failures**: Alert shown with error message
- **Missing Config**: Console warning if R2 not configured
- **Network Errors**: User notified, message not sent
- **File Size Limits**: Handled by R2 (configurable)
- **Invalid Files**: Browser file picker restricts types

---

## 📊 **Storage Structure**

```
R2 Bucket: crm-uploads
│
└── messages/
    ├── 1738754321123-photo.jpg
    ├── 1738754322456-document.pdf
    ├── 1738754323789-screenshot.png
    └── ...
```

Each file is uniquely named with timestamp to prevent conflicts.
