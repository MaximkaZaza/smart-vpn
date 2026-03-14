/**
 * Backup Script
 * Creates database backup and sends to Telegram
 */

require('dotenv').config();
const { sequelize } = require('../models');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const logger = require('../config/logger');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');
const MAX_BACKUPS = 7; // Keep 7 days of backups

async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `backup_${timestamp}.sql`);

  // Create backups directory
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const dbConfig = sequelize.config;
    const pgDumpCmd = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} ${dbConfig.database} > ${backupFile}`;
    
    exec(pgDumpCmd, { env: { PGPASSWORD: dbConfig.password } }, (error, stdout, stderr) => {
      if (error) {
        logger.error('Backup failed:', error);
        reject(error);
        return;
      }
      
      logger.info('Backup created:', backupFile);
      resolve(backupFile);
    });
  });
}

async function sendToTelegram(backupFile) {
  if (!process.env.BACKUP_TELEGRAM_CHAT_ID || !process.env.TELEGRAM_BOT_TOKEN) {
    logger.warn('Telegram backup not configured, skipping...');
    return;
  }

  const fileStream = fs.createReadStream(backupFile);
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendDocument`;
  
  const formData = new FormData();
  formData.append('chat_id', process.env.BACKUP_TELEGRAM_CHAT_ID);
  formData.append('document', fileStream);
  formData.append('caption', `📦 Backup ${new Date().toISOString().split('T')[0]}`);

  try {
    await axios.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    logger.info('Backup sent to Telegram');
  } catch (error) {
    logger.error('Failed to send backup to Telegram:', error.message);
  }
}

async function cleanupOldBackups() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .reverse();

  if (files.length > MAX_BACKUPS) {
    const toDelete = files.slice(MAX_BACKUPS);
    for (const file of toDelete) {
      fs.unlinkSync(path.join(BACKUP_DIR, file));
      logger.info('Deleted old backup:', file);
    }
  }
}

async function backup() {
  try {
    logger.info('Starting backup...');
    
    // Test database connection
    await sequelize.authenticate();
    logger.info('Database connection OK');
    
    // Create backup
    const backupFile = await createBackup();
    
    // Send to Telegram
    await sendToTelegram(backupFile);
    
    // Cleanup old backups
    await cleanupOldBackups();
    
    logger.info('Backup completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Backup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  backup();
}

module.exports = { createBackup, sendToTelegram, cleanupOldBackups };
