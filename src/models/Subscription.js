const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');

const Subscription = sequelize.define('Subscription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  planId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Plans',
      key: 'id'
    }
  },
  vlessUuid: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    unique: true
  },
  startDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  trafficLimitGB: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  trafficUsedGB: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  deviceLimit: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  serverId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Servers',
      key: 'id'
    }
  }
}, {
  timestamps: true,
  tableName: 'subscriptions',
  indexes: [
    { fields: ['userId'] },
    { fields: ['vlessUuid'] },
    { fields: ['isActive'] }
  ]
});

// Instance methods
Subscription.prototype.isActiveSubscription = function() {
  return this.isActive && this.endDate > new Date();
};

Subscription.prototype.getRemainingDays = function() {
  if (!this.endDate) return 0;
  const now = new Date();
  const end = new Date(this.endDate);
  const diffTime = end - now;
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

// Static methods
Subscription.findByUser = async function(userId) {
  return await this.findAll({
    where: { userId, isActive: true },
    order: [['endDate', 'DESC']]
  });
};

module.exports = Subscription;
