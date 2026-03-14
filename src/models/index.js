const { sequelize } = require('../config/database');
const User = require('./User');
const Subscription = require('./Subscription');
const Plan = require('./Plan');
const Transaction = require('./Transaction');
const Server = require('./Server');

// Define associations
User.hasMany(Subscription, { foreignKey: 'userId', as: 'subscriptions' });
Subscription.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Transaction, { foreignKey: 'userId', as: 'transactions' });
Transaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.belongsTo(User, { foreignKey: 'referredBy', as: 'referrer' });
User.hasMany(User, { foreignKey: 'referredBy', as: 'referrals' });

Plan.hasMany(Subscription, { foreignKey: 'planId', as: 'subscriptions' });
Subscription.belongsTo(Plan, { foreignKey: 'planId', as: 'plan' });

Server.hasMany(Subscription, { foreignKey: 'serverId', as: 'subscriptions' });
Subscription.belongsTo(Server, { foreignKey: 'serverId', as: 'server' });

// Sync all models
async function syncModels() {
  await sequelize.sync({ alter: false });
}

module.exports = {
  sequelize,
  User,
  Subscription,
  Plan,
  Transaction,
  Server,
  syncModels
};
