// Script to create admin account
const { createUserWithAuth } = require('./database');
const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function createAdmin() {
  try {
    const username = 'James';
    const password = 'James123';
    const passwordHash = hashPassword(password);
    
    const user = await createUserWithAuth(username, passwordHash, 1); // 1 = is_admin
    console.log('✅ Admin account created successfully!');
    console.log(`   Username: ${username}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Is Admin: ${user.is_admin === 1}`);
    process.exit(0);
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint')) {
      console.log('ℹ️  Admin account already exists');
    } else {
      console.error('❌ Error creating admin:', error);
    }
    process.exit(1);
  }
}

setTimeout(() => {
  createAdmin();
}, 1000);

