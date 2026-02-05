# MongoDB Backend Integration for Messaging

## Overview
The messaging system has been migrated from localStorage to MongoDB to enable real-time cross-user messaging.

## Backend API Endpoints

### 1. **send-message.ts**
- **Purpose**: Send a message to a user or group
- **Method**: POST
- **Parameters**:
  ```json
  {
    "id": "unique-message-id",
    "fromUserId": "sender-user-id",
    "fromUserName": "Sender Name",
    "toUserId": "recipient-user-id" (optional for group),
    "groupId": "group-id" (optional for direct),
    "content": "message text",
    "timestamp": "ISO date string",
    "isRead": false,
    "replyTo": "replied-message-id" (optional)
  }
  ```

### 2. **get-messages.ts**
- **Purpose**: Get messages between users or in a group
- **Method**: POST
- **Parameters**:
  ```json
  {
    "userId": "current-user-id",
    "otherUserId": "other-user-id" (optional),
    "groupId": "group-id" (optional)
  }
  ```
- **Returns**: Array of messages sorted by timestamp

### 3. **get-conversations.ts**
- **Purpose**: Get all conversations for a user
- **Method**: POST
- **Parameters**:
  ```json
  {
    "userId": "current-user-id"
  }
  ```
- **Returns**: Array of conversation objects with:
  - userId/userName (for direct messages)
  - groupId/groupName (for groups)
  - lastMessage, lastMessageTime
  - unreadCount
  - isPinned, isArchived status

### 4. **delete-conversation.ts**
- **Purpose**: Delete all messages in a conversation
- **Method**: POST
- **Parameters**:
  ```json
  {
    "userId": "current-user-id",
    "otherUserId": "other-user-id" (optional),
    "groupId": "group-id" (optional)
  }
  ```

### 5. **mark-as-read.ts**
- **Purpose**: Mark messages as read
- **Method**: POST
- **Parameters**:
  ```json
  {
    "userId": "current-user-id",
    "otherUserId": "other-user-id" (optional),
    "groupId": "group-id" (optional)
  }
  ```

### 6. **conversation-action.ts**
- **Purpose**: Manage conversation metadata (pin/archive)
- **Method**: POST
- **Parameters**:
  ```json
  {
    "userId": "current-user-id",
    "otherUserId": "other-user-id" (optional),
    "groupId": "group-id" (optional),
    "action": "togglePin|toggleArchive|isPinned|isArchived",
    "value": true/false (optional)
  }
  ```

## MongoDB Collections

### messages
Stores all messages between users and in groups:
```javascript
{
  id: string,
  fromUserId: string,
  fromUserName: string,
  toUserId: string | null,
  groupId: string | null,
  content: string,
  timestamp: ISO date string,
  isRead: boolean,
  replyTo: string | null,
  createdAt: Date
}
```

### conversation_meta
Stores conversation metadata (pinned, archived):
```javascript
{
  userId: string,
  conversationKey: "user_<userId>" or "group_<groupId>",
  isPinned: boolean,
  isArchived: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## Frontend Changes

### messagingService.ts
- All methods now async (return Promises)
- API calls to Netlify functions
- Automatic fallback to localStorage if API fails
- Changed `message` field to `content` for consistency

### MessagingCenter.tsx
- Updated all MessagingService calls to use async/await
- Added try-catch error handling
- Maintained same UI/UX experience

## Migration Steps

1. **Update MongoDB Setup**:
   - Ensure MONGODB_URI is configured in Netlify environment variables
   - Collections will be created automatically on first use

2. **Deploy Functions**:
   - All 6 Netlify functions are in `netlify/functions/`
   - Deploy via: `git push origin main` (auto-deploy on Netlify)

3. **Test Cross-User Messaging**:
   - Open two different browsers
   - Log in as different users
   - Send messages between users
   - Messages should sync in real-time (5-second polling)

## Fallback Mode

If MongoDB is unavailable or MONGODB_URI is not configured:
- System automatically falls back to localStorage
- Maintains full functionality within same browser
- Shows warnings in console for debugging

## Environment Variables Required

In Netlify dashboard → Site settings → Environment variables:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dg_crm?retryWrites=true&w=majority
```

## Testing

### Local Development
1. Start dev server: `npm run dev`
2. Messages will use localStorage (fallback mode)

### Production (Netlify)
1. Ensure MONGODB_URI is set
2. Deploy changes
3. Test with 2+ users in different browsers
4. Check MongoDB Atlas for message documents

## Benefits

✅ **Cross-User Messaging**: Users can message each other from different browsers/devices  
✅ **Persistent Storage**: Messages saved in cloud database  
✅ **Real-Time Updates**: 5-second polling keeps conversations synced  
✅ **Scalable**: MongoDB handles unlimited messages and users  
✅ **Fallback Support**: Works offline with localStorage  
✅ **Group Chat Ready**: Supports both direct messages and groups

## Next Steps (Optional Enhancements)

1. **WebSocket Integration**: Replace polling with real-time WebSocket connections
2. **Message Delivery Status**: Add "Delivered" and "Read" indicators
3. **Typing Indicators**: Show when other user is typing
4. **Push Notifications**: Browser notifications for new messages
5. **Message Search**: Full-text search across all messages
6. **Message Reactions**: Emoji reactions to messages
7. **File Upload History**: Track all files shared in conversation
