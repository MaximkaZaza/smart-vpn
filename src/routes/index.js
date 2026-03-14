const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const subscriptionRoutes = require('./subscription.routes');
const planRoutes = require('./plan.routes');
const paymentRoutes = require('./payment.routes');
const serverRoutes = require('./server.routes');
const adminRoutes = require('./admin.routes');

// Public routes
router.use('/auth', authRoutes);
router.use('/plans', planRoutes);

// Protected routes
router.use('/users', userRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/payments', paymentRoutes);
router.use('/servers', serverRoutes);

// Admin routes
router.use('/admin', adminRoutes);

module.exports = router;
