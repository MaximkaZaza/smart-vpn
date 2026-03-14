/**
 * Database Migration Script
 */

const { sequelize, syncModels } = require('../models');
const fs = require('fs');
const path = require('path');

async function migrate() {
  try {
    console.log('Starting database migration...');

    // Test connection
    await sequelize.authenticate();
    console.log('✓ Database connection established');

    // Sync models
    await syncModels();
    console.log('✓ Models synchronized');

    // Run SQL initialization scripts
    const initDir = path.join(__dirname, 'init');
    if (fs.existsSync(initDir)) {
      const files = fs.readdirSync(initDir).filter(f => f.endsWith('.sql'));
      
      for (const file of files) {
        console.log(`Running ${file}...`);
        const sql = fs.readFileSync(path.join(initDir, file), 'utf8');
        await sequelize.query(sql);
        console.log(`✓ ${file} completed`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

migrate();
