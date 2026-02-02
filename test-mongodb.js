// Test MongoDB Atlas Connection
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env file');
  process.exit(1);
}

console.log('🔄 Testing MongoDB Atlas connection...\n');

async function testConnection() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✅ Successfully connected to MongoDB Atlas!\n');
    
    // Get database
    const db = client.db('dg_crm');
    console.log('📁 Database: dg_crm\n');
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log(`📋 Existing collections (${collections.length}):`);
    if (collections.length > 0) {
      collections.forEach(col => console.log(`  - ${col.name}`));
    } else {
      console.log('  (No collections yet - will be created on first insert)');
    }
    
    // Test a simple operation
    console.log('\n🧪 Testing database operation...');
    const testCollection = db.collection('connection_test');
    const result = await testCollection.insertOne({
      test: true,
      timestamp: new Date(),
      message: 'MongoDB connection test successful'
    });
    console.log(`✅ Test document inserted with ID: ${result.insertedId}`);
    
    // Clean up test document
    await testCollection.deleteOne({ _id: result.insertedId });
    console.log('🧹 Test document cleaned up\n');
    
    console.log('✅ All tests passed! MongoDB is ready to use.');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Connection closed.');
  }
}

testConnection();
