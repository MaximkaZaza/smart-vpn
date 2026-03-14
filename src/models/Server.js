const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Server = sequelize.define('Server', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  region: {
    type: DataTypes.STRING,
    allowNull: false
  },
  country: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: false
  },
  port: {
    type: DataTypes.INTEGER,
    defaultValue: 443
  },
  protocol: {
    type: DataTypes.ENUM('VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'),
    defaultValue: 'VLESS'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isPrimary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  healthStatus: {
    type: DataTypes.ENUM('healthy', 'degraded', 'unhealthy', 'unknown'),
    defaultValue: 'unknown'
  },
  lastHealthCheck: {
    type: DataTypes.DATE,
    allowNull: true
  },
  maxConnections: {
    type: DataTypes.INTEGER,
    defaultValue: 1000
  },
  currentConnections: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  loadPercentage: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  config: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  metrics: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  timestamps: true,
  tableName: 'servers',
  indexes: [
    { fields: ['isActive'] },
    { fields: ['region'] },
    { fields: ['healthStatus'] }
  ]
});

// Instance methods
Server.prototype.isHealthy = function() {
  if (!this.lastHealthCheck) return false;
  const minutesSinceCheck = (Date.now() - this.lastHealthCheck.getTime()) / 60000;
  return this.healthStatus === 'healthy' && minutesSinceCheck < 5;
};

Server.prototype.updateHealth = async function(status) {
  this.healthStatus = status;
  this.lastHealthCheck = new Date();
  await this.save();
};

// Static methods
Server.getHealthyServers = async function() {
  return await this.findAll({
    where: { isActive: true, healthStatus: 'healthy' }
  });
};

Server.getPrimaryServer = async function() {
  return await this.findOne({
    where: { isActive: true, isPrimary: true }
  });
};

module.exports = Server;
