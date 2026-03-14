const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { User, Subscription, Transaction, Server, Plan } = require('../models');
const { Op } = require('sequelize');

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('admin', 'superadmin'));

/**
 * @route   GET /api/admin/stats
 * @desc    Get admin statistics
 * @access  Private/Admin
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const totalUsers = await User.count();
  const activeUsers = await User.count({ where: { isActive: true } });
  const totalSubscriptions = await Subscription.count();
  const activeSubscriptions = await Subscription.count({ 
    where: { isActive: true, endDate: { $gte: new Date() } }
  });
  const totalRevenue = await Transaction.sum('amount', { 
    where: { status: 'completed', type: 'deposit' }
  }) || 0;
  const servers = await Server.count();
  const healthyServers = await Server.count({ where: { healthStatus: 'healthy' } });

  res.json({
    success: true,
    data: {
      users: { total: totalUsers, active: activeUsers },
      subscriptions: { total: totalSubscriptions, active: activeSubscriptions },
      revenue: { total: totalRevenue, currency: 'RUB' },
      servers: { total: servers, healthy: healthyServers }
    }
  });
}));

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with pagination
 * @access  Private/Admin
 */
router.get('/users', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, status } = req.query;
  
  const where = {};
  if (search) {
    where[Op.or] = [
      { username: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } }
    ];
  }
  if (status) {
    where.isActive = status === 'active';
  }

  const { count, rows: users } = await User.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
    order: [['createdAt', 'DESC']],
    attributes: { exclude: ['passwordHash'] }
  });

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / parseInt(limit))
      }
    }
  });
}));

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update user (admin)
 * @access  Private/Admin
 */
router.put('/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found' }
    });
  }

  const { isActive, role, balance } = req.body;

  if (isActive !== undefined) user.isActive = isActive;
  if (role !== undefined) user.role = role;
  if (balance !== undefined) user.balance = balance;

  await user.save();

  res.json({
    success: true,
    data: { user }
  });
}));

/**
 * @route   GET /api/admin/subscriptions
 * @desc    Get all subscriptions
 * @access  Private/Admin
 */
router.get('/subscriptions', asyncHandler(async (req, res) => {
  const subscriptions = await Subscription.findAll({
    include: [
      { association: 'user', attributes: ['id', 'username', 'email'] },
      { association: 'plan', attributes: ['name', 'price'] },
      { association: 'server', attributes: ['name', 'region'] }
    ],
    order: [['createdAt', 'DESC']],
    limit: 50
  });

  res.json({
    success: true,
    data: { subscriptions }
  });
}));

/**
 * @route   GET /api/admin/transactions
 * @desc    Get all transactions
 * @access  Private/Admin
 */
router.get('/transactions', asyncHandler(async (req, res) => {
  const transactions = await Transaction.findAll({
    include: [{ association: 'user', attributes: ['id', 'username'] }],
    order: [['createdAt', 'DESC']],
    limit: 50
  });

  res.json({
    success: true,
    data: { transactions }
  });
}));

/**
 * @route   POST /api/admin/plans
 * @desc    Create new plan
 * @access  Private/Admin
 */
router.post('/plans', asyncHandler(async (req, res) => {
  const plan = await Plan.create(req.body);

  res.status(201).json({
    success: true,
    data: { plan }
  });
}));

/**
 * @route   PUT /api/admin/plans/:id
 * @desc    Update plan
 * @access  Private/Admin
 */
router.put('/plans/:id', asyncHandler(async (req, res) => {
  const plan = await Plan.findByPk(req.params.id);

  if (!plan) {
    return res.status(404).json({
      success: false,
      error: { code: 'PLAN_NOT_FOUND', message: 'Plan not found' }
    });
  }

  await plan.update(req.body);

  res.json({
    success: true,
    data: { plan }
  });
}));

module.exports = router;
