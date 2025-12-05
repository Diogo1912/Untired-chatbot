// Script to create the default admin account
const crypto = require('crypto');
const readline = require('readline');
const { createUserWithAuth } = require('./database-mongo');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function setupAdmin() {
  console.log('\n🛠️  Untire Coach - Admin Setup\n');
  console.log('This script will create the default admin account.');
  console.log('The admin account can then create additional user accounts.\n');

  rl.question('Enter admin username: ', (username) => {
    rl.question('Enter admin password: ', async (password) => {
      try {
        const passwordHash = hashPassword(password);
        const admin = await createUserWithAuth(username, passwordHash, true);
        
        console.log('\n✅ Admin account created successfully!');
        console.log(`Username: ${admin.username}`);
        console.log(`User ID: ${admin._id}`);
        console.log('\nYou can now log in at /admin.html with these credentials.');
        console.log('The admin account can create new user accounts from the admin console.\n');
        
        process.exit(0);
      } catch (error) {
        console.error('\n❌ Failed to create admin account:', error.message);
        console.error('Make sure MongoDB is running and MONGODB_URI is set in .env\n');
        process.exit(1);
      }
    });
  });
}

setupAdmin();

