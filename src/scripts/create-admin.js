/**
 * Script to create admin user
 * Usage: node src/scripts/create-admin.js
 */

require('dotenv').config();
const { User } = require('../models');

async function createAdmin() {
  try {
    const email = process.env.ADMIN_EMAIL || 'admin@vpn.local';
    const username = 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';

    // Check if admin exists
    const existingAdmin = await User.findOne({ where: { email } });
    
    if (existingAdmin) {
      console.log('Admin user already exists');
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log('✓ Updated user role to admin');
      }
      process.exit(0);
    }

    // Create admin
    const admin = await User.create({
      username,
      email,
      role: 'admin',
      balance: 0
    });

    await admin.setPassword(password);
    await admin.save();

    console.log('✅ Admin user created successfully!');
    console.log('\nCredentials:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('\n⚠️  Change the default password immediately!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createAdmin();
