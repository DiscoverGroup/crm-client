// One-time script: hash the admin password and upsert the admin user in MongoDB
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

const MONGODB_URI = 'mongodb+srv://noreplydiscovergrp_db_user:clInR6gDauNljtjF@dg-crm-cluster.rfb5xvh.mongodb.net/dg_crm?retryWrites=true&w=majority&appName=dg-crm-cluster';
const ADMIN_EMAIL    = 'admin@discovergrp.com';
const ADMIN_PASSWORD = 'Admin@DG2026!';

const client = await MongoClient.connect(MONGODB_URI, {
  tls: true,
  tlsAllowInvalidCertificates: false,
  serverSelectionTimeoutMS: 15000,
});

try {
  const db    = client.db('dg_crm');
  const users = db.collection('users');

  console.log('Hashing password...');
  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const result = await users.updateOne(
    { email: ADMIN_EMAIL },
    {
      $set: {
        email:      ADMIN_EMAIL,
        username:   'admin',
        fullName:   'Administrator',
        password:   hashed,
        role:       'admin',
        isVerified: true,
        department: 'Information & Technology Department',
        position:   'IT Manager',
        updatedAt:  new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  const action = result.upsertedCount > 0 ? 'CREATED' : 'UPDATED';
  console.log(`✅ Admin account ${action} successfully`);
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
} finally {
  await client.close();
}
