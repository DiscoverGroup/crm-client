# MongoDB Configuration

## Local Development Setup

1. Make sure MongoDB is running locally on port 27017
2. The database name is `dg_crm`

## Collections

The application uses the following MongoDB collections:

- **users** - User accounts and authentication
- **clients** - Client records
- **activity_logs** - Activity tracking
- **file_attachments** - File metadata
- **payments** - Payment records
- **log_notes** - Notes and logs
- **messages** - Direct and group messages
- **conversation_meta** - Conversation metadata (pinned, archived status)
- **groups** - Group chat definitions and participants

## Environment Variables

For production deployment, set:

```env
MONGODB_URI=your_mongodb_connection_string
```

## Migration from localStorage

The app will automatically sync localStorage data to MongoDB on first connection.

## MongoDB Compass Connection

Use this connection string in MongoDB Compass:
```
mongodb://localhost:27017
```
