const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');

const Transaction = sequelize.define('Transaction', {
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
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.ENUM('RUB', 'USD', 'EUR', 'BTC', 'ETH', 'USDT'),
    defaultValue: 'RUB'
  },
  type: {
    type: DataTypes.ENUM('deposit', 'payment', 'refund', 'bonus', 'referral'),
    defaultValue: 'deposit'
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'),
    defaultValue: 'pending'
  },
  paymentMethod: {
    type: DataTypes.ENUM('card', 'crypto', 'yookassa', 'stripe', 'qiwi', 'bonus'),
    allowNull: true
  },
  paymentGatewayId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'transactions',
  indexes: [
    { fields: ['userId'] },
    { fields: ['status'] },
    { fields: ['paymentGatewayId'] }
  ]
});

// Instance methods
Transaction.prototype.complete = async function() {
  this.status = 'completed';
  this.paidAt = new Date();
  await this.save();
};

Transaction.prototype.fail = async function() {
  this.status = 'failed';
  await this.save();
};

module.exports = Transaction;
