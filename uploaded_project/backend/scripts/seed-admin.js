const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const readline = require('readline');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import User model
const User = require('../models/User');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function seedAdmin() {
  try {
    console.log('\n🔧 ToolStack CRM - Admin Account Setup\n');
    
    // Connect to MongoDB
    const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
    const DB_NAME = process.env.DB_NAME || 'toolstack_crm';
    const FULL_MONGO_URL = `${MONGO_URL}/${DB_NAME}`;
    
    console.log(`📦 Connecting to MongoDB: ${FULL_MONGO_URL}`);
    await mongoose.connect(FULL_MONGO_URL);
    console.log('✅ Connected to MongoDB\n');
    
    // Get admin details
    let email = process.env.INITIAL_ADMIN_EMAIL;
    let password = process.env.INITIAL_ADMIN_PASSWORD;
    let fullName = process.env.INITIAL_ADMIN_NAME;
    
    if (!email || !password || !fullName) {
      console.log('💡 Admin credentials not found in .env. Let\'s create one:\n');
      
      email = await question('Admin Email: ');
      fullName = await question('Admin Full Name: ');
      password = await question('Admin Password (min 8 chars): ');
      
      if (!email || !fullName || !password) {
        console.error('\n❌ All fields are required!');
        process.exit(1);
      }
      
      if (password.length < 8) {
        console.error('\n❌ Password must be at least 8 characters!');
        process.exit(1);
      }
    }
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email, role: { $in: ['SUPER_ADMIN', 'ADMIN'] } });
    
    if (existingAdmin) {
      console.log(`\n⚠️  Admin with email ${email} already exists!`);
      const overwrite = await question('Do you want to update the password? (yes/no): ');
      
      if (overwrite.toLowerCase() === 'yes' || overwrite.toLowerCase() === 'y') {
        existingAdmin.passwordHash = password; // Will be hashed by pre-save hook
        await existingAdmin.save();
        console.log('\n✅ Admin password updated successfully!');
      } else {
        console.log('\n❌ Operation cancelled.');
      }
    } else {
      // Create new admin
      const admin = await User.create({
        email,
        fullName,
        passwordHash: password, // Will be hashed by pre-save hook
        role: 'SUPER_ADMIN',
        status: 'active',
        devicePolicy: {
          enabled: false, // Admins don't need device binding
          maxDevices: 10
        }
      });
      
      console.log('\n✅ Admin account created successfully!');
      console.log('\n📋 Admin Details:');
      console.log(`   Email: ${admin.email}`);
      console.log(`   Name: ${admin.fullName}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   ID: ${admin._id}`);
    }
    
    console.log('\n🎉 Setup complete! You can now login to the admin portal.\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await mongoose.connection.close();
    process.exit(0);
  }
}

// Run seed
seedAdmin();
