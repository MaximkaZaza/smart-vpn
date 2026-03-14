const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { Subscription, Plan, Server } = require('../models');
const { generateVLESSConfig } = require('../services/xray.service');

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
      { association: 'server', attributes: ['name', 'region', 'country'] }
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
      link: config.link
    }
  });
}));

/**
 * @route   POST /api/subscriptions/activate
 * @desc    Activate subscription with plan
 * @access  Private
 */
router.post('/activate', authenticate, asyncHandler(async (req, res) => {
  const { planId } = req.body;

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

  // Get server
  const server = await Server.getPrimaryServer();
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

  // Deduct balance
  user.balance = parseFloat(user.balance) - parseFloat(plan.price);
  await user.save();

  res.status(201).json({
    success: true,
    data: { subscription }
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

  subscription.isActive = false;
  await subscription.save();

  res.json({
    success: true,
    message: 'Subscription cancelled successfully'
  });
}));

module.exports = router;
