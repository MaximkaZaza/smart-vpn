const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { Transaction, User } = require('../models');
const { createPaymentIntent, verifyPayment } = require('../services/payment.service');

/**
 * @route   POST /api/payments/create
 * @desc    Create payment intent
 * @access  Private
 */
router.post('/create', authenticate, asyncHandler(async (req, res) => {
  const { amount, currency = 'RUB', method = 'card' } = req.body;

  if (!amount || amount < 100) {
    throw new AppError('Minimum amount is 100', 400, 'INVALID_AMOUNT');
  }

  // Create transaction
  const transaction = await Transaction.create({
    userId: req.user.id,
    amount,
    currency,
    type: 'deposit',
    status: 'pending',
    paymentMethod: method
  });

  // Create payment intent
  const paymentIntent = await createPaymentIntent({
    amount,
    currency,
    method,
    transactionId: transaction.id
  });

  transaction.paymentGatewayId = paymentIntent.id;
  await transaction.save();

  res.json({
    success: true,
    data: {
      transactionId: transaction.id,
      clientSecret: paymentIntent.clientSecret,
      paymentUrl: paymentIntent.paymentUrl
    }
  });
}));

/**
 * @route   POST /api/payments/confirm
 * @desc    Confirm payment
 * @access  Private
 */
router.post('/confirm', authenticate, asyncHandler(async (req, res) => {
  const { transactionId, paymentData } = req.body;

  const transaction = await Transaction.findOne({
    where: { id: transactionId, userId: req.user.id }
  });

  if (!transaction) {
    throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
  }

  if (transaction.status !== 'pending') {
    throw new AppError('Transaction already processed', 400, 'TRANSACTION_PROCESSED');
  }

  // Verify payment
  const paymentResult = await verifyPayment({
    transactionId: transaction.paymentGatewayId,
    paymentData
  });

  if (paymentResult.success) {
    await transaction.complete();
    
    // Update user balance
    const user = await User.findByPk(req.user.id);
    user.balance = parseFloat(user.balance) + parseFloat(transaction.amount);
    await user.save();

    res.json({
      success: true,
      data: { transaction, newBalance: user.balance }
    });
  } else {
    await transaction.fail();
    throw new AppError('Payment verification failed', 400, 'PAYMENT_FAILED');
  }
}));

/**
 * @route   GET /api/payments/history
 * @desc    Get payment history
 * @access  Private
 */
router.get('/history', authenticate, asyncHandler(async (req, res) => {
  const transactions = await Transaction.findAll({
    where: { userId: req.user.id },
    order: [['createdAt', 'DESC']],
    limit: 50
  });

  res.json({
    success: true,
    data: { transactions }
  });
}));

/**
 * @route   GET /api/payments/:id
 * @desc    Get transaction details
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const transaction = await Transaction.findOne({
    where: { id: req.params.id, userId: req.user.id }
  });

  if (!transaction) {
    throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
  }

  res.json({
    success: true,
    data: { transaction }
  });
}));

module.exports = router;
