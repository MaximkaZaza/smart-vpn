const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { Plan } = require('../models');

/**
 * @route   GET /api/plans
 * @desc    Get all available plans
 * @access  Public
 */
router.get('/', asyncHandler(async (req, res) => {
  const plans = await Plan.findAll({
    where: { isActive: true },
    order: [['sortOrder', 'ASC'], ['price', 'ASC']]
  });

  res.json({
    success: true,
    data: { plans }
  });
}));

/**
 * @route   GET /api/plans/:id
 * @desc    Get single plan
 * @access  Public
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const plan = await Plan.findByPk(req.params.id);

  if (!plan || !plan.isActive) {
    return res.status(404).json({
      success: false,
      error: { code: 'PLAN_NOT_FOUND', message: 'Plan not found' }
    });
  }

  res.json({
    success: true,
    data: { plan }
  });
}));

module.exports = router;
