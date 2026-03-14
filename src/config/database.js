const { Sequelize } = require('sequelize');
const logger = require('../config/logger');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'vpn_db',
  process.env.DB_USER || 'vpn_user',
  process.env.DB_PASSWORD || 'vpn_password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: (msg) => logger.debug(msg),
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

module.exports = { sequelize };
