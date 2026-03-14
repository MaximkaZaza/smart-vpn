const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { Subscription, Plan, Server } = require('../models');
const { generateVLESSConfig } = require('../services/xray.service');
const deploymentService = require('../services/server-deployment.service');

/**
 * @route   GET /api/subscriptions
 * @desc    Get user subscriptions
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const subscriptions = await Subscription.findAll({
    where: { userId: req.user.id },
    include: [
      { association: 'plan', attributes: ['name', 'price', 'currency'] },
      { association: 'server', attributes: ['name', 'region', 'country', 'ipAddress'] }
    ],
    order: [['createdAt', 'DESC']]
  });

  res.json({
    success: true,
    data: { subscriptions }
  });
}));

/**
 * @route   GET /api/subscriptions/active
 * @desc    Get active subscription
 * @access  Private
 */
router.get('/active', authenticate, asyncHandler(async (req, res) => {
  const subscription = await Subscription.findOne({
    where: { 
      userId: req.user.id, 
      isActive: true,
      endDate: { $gte: new Date() }
    },
    include: [
      { association: 'plan' },
      { association: 'server' }
    ]
  });

  if (!subscription) {
    throw new AppError('No active subscription found', 404, 'NO_SUBSCRIPTION');
  }

  res.json({
    success: true,
    data: { subscription }
  });
}));

/**
 * @route   GET /api/subscriptions/config
 * @desc    Get VLESS configuration
 * @access  Private
 */
router.get('/config', authenticate, asyncHandler(async (req, res) => {
  const subscription = await Subscription.findOne({
    where: { 
      userId: req.user.id, 
      isActive: true,
      endDate: { $gte: new Date() }
    },
    include: [{ association: 'server' }]
  });

  if (!subscription) {
    throw new AppError('No active subscription found', 404, 'NO_SUBSCRIPTION');
  }

  const server = subscription.server || await Server.getPrimaryServer();
  
  if (!server) {
    throw new AppError('No available server found', 503, 'NO_SERVER');
  }

  const config = generateVLESSConfig({
    uuid: subscription.vlessUuid,
    server,
    subscription
  });

  res.json({
    success: true,
    data: {
      vless: config.vless,
      qrCode: config.qrCode,
      link: config.link,
      server: {
        name: server.name,
        region: server.region,
        country: server.country
      }
    }
  });
}));

/**
 * @route   GET /api/subscriptions/servers
 * @desc    Get available servers for selection
 * @access  Private
 */
router.get('/servers', authenticate, asyncHandler(async (req, res) => {
  const servers = await Server.findAll({
    where: {
      isActive: true,
      healthStatus: 'healthy'
    },
    attributes: ['id', 'name', 'region', 'country', 'loadPercentage', 'maxConnections', 'currentConnections']
  });

  res.json({
    success: true,
    data: { servers }
  });
}));

/**
 * @route   POST /api/subscriptions/activate
 * @desc    Activate subscription with plan and server selection
 * @access  Private
 */
router.post('/activate', authenticate, asyncHandler(async (req, res) => {
  const { planId, serverId } = req.body;

  if (!planId) {
    throw new AppError('Plan ID is required', 400, 'PLAN_REQUIRED');
  }

  const plan = await Plan.findByPk(planId);

  if (!plan || !plan.isActive) {
    throw new AppError('Plan not found or inactive', 404, 'PLAN_NOT_FOUND');
  }

  // Check user balance
  const user = req.user;
  if (user.balance < plan.price) {
    throw new AppError('Insufficient balance', 402, 'INSUFFICIENT_BALANCE');
  }

  // Get server (auto-select best if not specified)
  let server;
  if (serverId) {
    server = await Server.findByPk(serverId);
    if (!server || !server.isActive || server.healthStatus !== 'healthy') {
      throw new AppError('Selected server is not available', 400, 'SERVER_UNAVAILABLE');
    }
  } else {
    // Auto-select best server (lowest load)
    server = await Server.findOne({
      where: {
        isActive: true,
        healthStatus: 'healthy'
      },
      order: [['loadPercentage', 'ASC']]
    });
  }

  if (!server) {
    throw new AppError('No available server found', 503, 'NO_SERVER');
  }

  // Create subscription
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.getDurationDays());

  const subscription = await Subscription.create({
    userId: user.id,
    planId: plan.id,
    vlessUuid: require('uuid').v4(),
    endDate,
    trafficLimitGB: plan.trafficLimitGB,
    deviceLimit: plan.deviceLimit,
    serverId: server.id
  });

  // Add client to Xray server
  try {
    await deploymentService.addClientToServer(
      server.ipAddress,
      subscription.vlessUuid,
      server.config
    );
  } catch (error) {
    console.error('Failed to add client to server:', error);
    // Continue anyway - client can be added later
  }

  // Update server load
  server.currentConnections += 1;
  server.loadPercentage = (server.currentConnections / server.maxConnections) * 100;
  await server.save();

  // Deduct balance
  user.balance = parseFloat(user.balance) - parseFloat(plan.price);
  await user.save();

  res.status(201).json({
    success: true,
    data: { 
      subscription,
      server: {
        id: server.id,
        name: server.name,
        region: server.region,
        country: server.country
      }
    }
  });
}));

/**
 * @route   PUT /api/subscriptions/:id/change-server
 * @desc    Change server for subscription
 * @access  Private
 */
router.put('/:id/change-server', authenticate, asyncHandler(async (req, res) => {
  const { serverId } = req.body;
  const subscription = await Subscription.findOne({
    where: { id: req.params.id, userId: req.user.id }
  });

  if (!subscription) {
    throw new AppError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
  }

  const newServer = await Server.findByPk(serverId);
  if (!newServer || !newServer.isActive || newServer.healthStatus !== 'healthy') {
    throw new AppError('Selected server is not available', 400, 'SERVER_UNAVAILABLE');
  }

  // Remove from old server
  const oldServer = await Server.findByPk(subscription.serverId);
  if (oldServer) {
    try {
      await deploymentService.removeClientFromServer(
        oldServer.ipAddress,
        subscription.vlessUuid,
        oldServer.config
      );
      oldServer.currentConnections = Math.max(0, oldServer.currentConnections - 1);
      await oldServer.save();
    } catch (error) {
      console.error('Failed to remove from old server:', error);
    }
  }

  // Add to new server
  try {
    await deploymentService.addClientToServer(
      newServer.ipAddress,
      subscription.vlessUuid,
      newServer.config
    );
    newServer.currentConnections += 1;
    newServer.loadPercentage = (newServer.currentConnections / newServer.maxConnections) * 100;
    await newServer.save();
  } catch (error) {
    throw new AppError('Failed to add client to new server', 500, 'SERVER_ADD_FAILED');
  }

  subscription.serverId = newServer.id;
  await subscription.save();

  res.json({
    success: true,
    message: 'Server changed successfully',
    data: {
      subscription,
      newServer: {
        id: newServer.id,
        name: newServer.name,
        region: newServer.region,
        country: newServer.country
      }
    }
  });
}));

/**
 * @route   DELETE /api/subscriptions/:id
 * @desc    Cancel subscription
 * @access  Private
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const subscription = await Subscription.findOne({
    where: { id: req.params.id, userId: req.user.id }
  });

  if (!subscription) {
    throw new AppError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
  }

  // Remove from server
  const server = await Server.findByPk(subscription.serverId);
  if (server) {
    try {
      await deploymentService.removeClientFromServer(
        server.ipAddress,
        subscription.vlessUuid,
        server.config
      );
      server.currentConnections = Math.max(0, server.currentConnections - 1);
      await server.save();
    } catch (error) {
      console.error('Failed to remove from server:', error);
    }
  }

  subscription.isActive = false;
  await subscription.save();

  res.json({
    success: true,
    message: 'Subscription cancelled successfully'
  });
}));

module.exports = router;
