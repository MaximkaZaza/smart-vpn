const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { User, Subscription, Transaction, Server, Plan } = require('../models');
const { Op } = require('sequelize');
const deploymentService = require('../services/server-deployment.service');
const healthMonitor = require('../services/server-health.service');
const { body, validationResult } = require('express-validator');

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

/**
 * @route   GET /api/admin/servers
 * @desc    Get all servers
 * @access  Private/Admin
 */
router.get('/servers', asyncHandler(async (req, res) => {
  const servers = await Server.findAll({
    order: [['createdAt', 'DESC']]
  });

  res.json({
    success: true,
    data: { servers }
  });
}));

/**
 * @route   POST /api/admin/servers
 * @desc    Add new server with auto-deployment
 * @access  Private/Admin
 */
router.post('/servers', [
  body('name').notEmpty().withMessage('Server name is required'),
  body('ipAddress').isIP().withMessage('Valid IP address is required'),
  body('region').notEmpty().withMessage('Region is required'),
  body('country').notEmpty().withMessage('Country is required'),
  body('sshUsername').notEmpty().withMessage('SSH username is required'),
  body('sshPassword').optional(),
  body('sshPrivateKey').optional()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
  }

  const {
    name, region, country, ipAddress, port = 443,
    sshUsername, sshPassword, sshPrivateKey, sshPort = 22,
    domain, adminEmail, dbHost, dbPassword
  } = req.body;

  // Create server record
  const server = await Server.create({
    name,
    region,
    country,
    ipAddress,
    port,
    healthStatus: 'unknown',
    config: {
      sshUsername,
      sshPort,
      domain,
      dbHost,
      dbPassword
    }
  });

  // Deploy Xray on server
  const deploymentResult = await deploymentService.deployServer({
    ipAddress,
    username: sshUsername,
    password: sshPassword,
    privateKey: sshPrivateKey,
    sshPort,
    domain,
    adminEmail,
    dbHost,
    dbPassword
  });

  if (deploymentResult.success) {
    await server.update({
      healthStatus: 'healthy',
      lastHealthCheck: new Date()
    });
  } else {
    await server.update({
      healthStatus: 'unhealthy'
    });
  }

  res.status(201).json({
    success: true,
    data: {
      server,
      deployment: deploymentResult
    }
  });
}));

/**
 * @route   POST /api/admin/servers/deploy-multiple
 * @desc    Deploy multiple servers at once
 * @access  Private/Admin
 */
router.post('/servers/deploy-multiple', asyncHandler(async (req, res) => {
  const { servers } = req.body;

  if (!Array.isArray(servers) || servers.length === 0) {
    throw new AppError('Servers array is required', 400, 'VALIDATION_ERROR');
  }

  const results = await deploymentService.deployMultipleServers(servers);

  // Create server records in database
  const createdServers = [];
  for (const result of results) {
    if (result.success) {
      const server = await Server.create({
        name: result.server.name,
        region: result.server.region,
        country: result.server.country,
        ipAddress: result.server.ipAddress,
        healthStatus: 'healthy',
        lastHealthCheck: new Date(),
        config: result.server.config
      });
      createdServers.push(server);
    }
  }

  res.json({
    success: true,
    data: {
      results,
      createdServers
    }
  });
}));

/**
 * @route   PUT /api/admin/servers/:id
 * @desc    Update server
 * @access  Private/Admin
 */
router.put('/servers/:id', asyncHandler(async (req, res) => {
  const server = await Server.findByPk(req.params.id);

  if (!server) {
    throw new AppError('Server not found', 404, 'SERVER_NOT_FOUND');
  }

  const updatableFields = [
    'name', 'region', 'country', 'ipAddress', 'port',
    'protocol', 'isActive', 'isPrimary', 'maxConnections', 'config'
  ];

  for (const field of updatableFields) {
    if (req.body[field] !== undefined) {
      server[field] = req.body[field];
    }
  }

  await server.save();

  res.json({
    success: true,
    data: { server }
  });
}));

/**
 * @route   DELETE /api/admin/servers/:id
 * @desc    Delete server
 * @access  Private/Admin
 */
router.delete('/servers/:id', asyncHandler(async (req, res) => {
  const server = await Server.findByPk(req.params.id);

  if (!server) {
    throw new AppError('Server not found', 404, 'SERVER_NOT_FOUND');
  }

  // Check if server has active subscriptions
  const activeSubscriptions = await Subscription.count({
    where: { serverId: server.id, isActive: true }
  });

  if (activeSubscriptions > 0) {
    throw new AppError(
      `Cannot delete server with ${activeSubscriptions} active subscriptions`,
      400,
      'SERVER_HAS_SUBSCRIPTIONS'
    );
  }

  await server.destroy();

  res.json({
    success: true,
    message: 'Server deleted successfully'
  });
}));

/**
 * @route   POST /api/admin/servers/:id/health-check
 * @desc    Check server health
 * @access  Private/Admin
 */
router.post('/servers/:id/health-check', asyncHandler(async (req, res) => {
  const server = await Server.findByPk(req.params.id);

  if (!server) {
    throw new AppError('Server not found', 404, 'SERVER_NOT_FOUND');
  }

  const health = await deploymentService.checkServerHealth(server);

  res.json({
    success: true,
    data: {
      serverId: server.id,
      healthy: health.healthy,
      lastCheck: new Date()
    }
  });
}));

/**
 * @route   POST /api/admin/servers/:id/add-client
 * @desc    Add client to server
 * @access  Private/Admin
 */
router.post('/servers/:id/add-client', asyncHandler(async (req, res) => {
  const server = await Server.findByPk(req.params.id);
  const { clientUuid, sshCredentials } = req.body;

  if (!server) {
    throw new AppError('Server not found', 404, 'SERVER_NOT_FOUND');
  }

  if (!clientUuid || !sshCredentials) {
    throw new AppError('clientUuid and sshCredentials are required', 400, 'VALIDATION_ERROR');
  }

  const result = await deploymentService.addClientToServer(
    server.ipAddress,
    clientUuid,
    sshCredentials
  );

  res.json({
    success: true,
    data: { result }
  });
}));

/**
 * @route   POST /api/admin/servers/:id/remove-client
 * @desc    Remove client from server
 * @access  Private/Admin
 */
router.post('/servers/:id/remove-client', asyncHandler(async (req, res) => {
  const server = await Server.findByPk(req.params.id);
  const { clientUuid, sshCredentials } = req.body;

  if (!server) {
    throw new AppError('Server not found', 404, 'SERVER_NOT_FOUND');
  }

  const result = await deploymentService.removeClientFromServer(
    server.ipAddress,
    clientUuid,
    sshCredentials
  );

  res.json({
    success: true,
    data: { result }
  });
}));

/**
 * @route   GET /api/admin/servers/health-stats
 * @desc    Get servers health statistics
 * @access  Private/Admin
 */
router.get('/servers/health-stats', asyncHandler(async (req, res) => {
  const stats = await healthMonitor.getHealthStats();

  res.json({
    success: true,
    data: { stats }
  });
}));

/**
 * @route   POST /api/admin/servers/:id/restart
 * @desc    Restart unhealthy server
 * @access  Private/Admin
 */
router.post('/servers/:id/restart', asyncHandler(async (req, res) => {
  const server = await Server.findByPk(req.params.id);
  const { sshCredentials } = req.body;

  if (!server) {
    throw new AppError('Server not found', 404, 'SERVER_NOT_FOUND');
  }

  const result = await healthMonitor.restartUnhealthyServer(server.id, sshCredentials);

  res.json({
    success: true,
    data: { result }
  });
}));

module.exports = router;
