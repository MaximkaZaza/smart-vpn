const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { User } = require('../models');

/**
 * @route   GET /api/users/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: { exclude: ['passwordHash'] },
    include: [
      { association: 'subscriptions', where: { isActive: true }, required: false },
      { association: 'transactions', limit: 5, order: [['createdAt', 'DESC']], required: false }
    ]
  });

  res.json({
    success: true,
    data: { user }
  });
}));

/**
 * @route   PUT /api/users/me
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/me', authenticate, asyncHandler(async (req, res) => {
  const { username, email } = req.body;

  const user = await User.findByPk(req.user.id);

  if (username) user.username = username;
  if (email) user.email = email;

  await user.save();

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    }
  });
}));

/**
 * @route   GET /api/users/balance
 * @desc    Get user balance
 * @access  Private
 */
router.get('/balance', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id);

  res.json({
    success: true,
    data: {
      balance: user.balance,
      currency: 'RUB'
    }
  });
}));

/**
 * @route   GET /api/users/referrals
 * @desc    Get user referrals
 * @access  Private
 */
router.get('/referrals', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    include: [{ association: 'referrals', attributes: ['id', 'username', 'createdAt'] }]
  });

  const totalReferrals = user.referrals?.length || 0;
  const bonusEarned = totalReferrals * 100; // 100 RUB per referral

  res.json({
    success: true,
    data: {
      refCode: user.refCode,
      refLink: `https://your-vpn.com/?ref=${user.refCode}`,
      totalReferrals,
      bonusEarned,
      referrals: user.referrals || []
    }
  });
}));

module.exports = router;
