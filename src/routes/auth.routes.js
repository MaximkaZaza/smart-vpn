const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post('/register', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
  }

  const { username, email, password, refCode } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({
    where: { 
      $or: [{ email }, { username }] 
    }
  });

  if (existingUser) {
    throw new AppError('User with this email or username already exists', 409, 'USER_EXISTS');
  }

  // Find referrer
  let referrer = null;
  if (refCode) {
    referrer = await User.findOne({ where: { refCode } });
  }

  // Create user
  const user = await User.create({
    username,
    email,
    referrerId: referrer?.id
  });

  await user.setPassword(password);
  await user.save();

  // Generate JWT token
  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        refCode: user.refCode
      },
      token
    }
  });
}));

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
  }

  const { email, password } = req.body;

  const user = await User.findOne({ where: { email } });

  if (!user || !(await user.validatePassword(password))) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw new AppError('Account is deactivated', 403, 'ACCOUNT_INACTIVE');
  }

  // Update last login
  user.lastLoginAt = new Date();
  await user.save();

  // Generate JWT token
  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      token
    }
  });
}));

/**
 * @route   POST /api/auth/telegram
 * @desc    Authenticate via Telegram
 * @access  Public
 */
router.post('/telegram', asyncHandler(async (req, res) => {
  const { telegramId, username, firstName, lastName } = req.body;

  if (!telegramId) {
    throw new AppError('Telegram ID is required', 400, 'TELEGRAM_ID_REQUIRED');
  }

  // Find or create user
  let user = await User.findOne({ where: { telegramId } });

  if (!user) {
    user = await User.create({
      telegramId,
      username: username || `user_${telegramId}`
    });
  }

  // Generate JWT token
  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        telegramId: user.telegramId
      },
      token
    }
  });
}));

module.exports = router;
