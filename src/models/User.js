const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  telegramId: {
    type: DataTypes.BIGINT,
    unique: true,
    allowNull: true
  },
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: true
  },
  balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  refCode: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  referredBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  role: {
    type: DataTypes.ENUM('user', 'admin', 'superadmin'),
    defaultValue: 'user'
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'users',
  indexes: [
    { fields: ['telegramId'] },
    { fields: ['refCode'] },
    { fields: ['email'] }
  ]
});

// Instance methods
User.prototype.setPassword = async function(password) {
  this.passwordHash = await bcrypt.hash(password, 12);
};

User.prototype.validatePassword = async function(password) {
  if (!this.passwordHash) return false;
  return await bcrypt.compare(password, this.passwordHash);
};

User.prototype.generateRefCode = function() {
  this.refCode = `ref_${this.id.toString().split('-')[0]}`;
};

// Hooks
User.beforeCreate((user) => {
  if (!user.refCode) {
    user.generateRefCode();
  }
});

module.exports = User;
