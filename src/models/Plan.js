const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Plan = sequelize.define('Plan', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.ENUM('RUB', 'USD', 'EUR', 'BTC', 'ETH', 'USDT'),
    defaultValue: 'RUB'
  },
  duration: {
    type: DataTypes.ENUM('1month', '3months', '6months', '1year'),
    defaultValue: '1month'
  },
  durationDays: {
    type: DataTypes.INTEGER,
    defaultValue: 30
  },
  trafficLimitGB: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  deviceLimit: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  speedLimitMbps: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  features: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isPopular: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  timestamps: true,
  tableName: 'plans',
  indexes: [
    { fields: ['isActive'] },
    { fields: ['currency'] }
  ]
});

// Instance methods
Plan.prototype.getDurationDays = function() {
  const durationMap = {
    '1month': 30,
    '3months': 90,
    '6months': 180,
    '1year': 365
  };
  return durationMap[this.duration] || this.durationDays;
};

module.exports = Plan;
