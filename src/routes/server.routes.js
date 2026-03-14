const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { Server } = require('../models');

/**
 * @route   GET /api/servers
 * @desc    Get all servers (admin only)
 * @access  Private/Admin
 */
router.get('/', authenticate, authorize('admin', 'superadmin'), asyncHandler(async (req, res) => {
  const servers = await Server.findAll({
    order: [['createdAt', 'DESC']]
  });

  res.json({
    success: true,
    data: { servers }
  });
}));

/**
 * @route   GET /api/servers/available
 * @desc    Get available servers for users
 * @access  Public
 */
router.get('/available', asyncHandler(async (req, res) => {
  const servers = await Server.getHealthyServers();

  res.json({
    success: true,
    data: { 
      servers: servers.map(s => ({
        id: s.id,
        name: s.name,
        region: s.region,
        country: s.country,
        loadPercentage: s.loadPercentage
      }))
    }
  });
}));

/**
 * @route   POST /api/servers
 * @desc    Create new server (admin only)
 * @access  Private/Admin
 */
router.post('/', authenticate, authorize('superadmin'), asyncHandler(async (req, res) => {
  const { name, region, country, ipAddress, port, protocol, isPrimary, config } = req.body;

  const server = await Server.create({
    name,
    region,
    country,
    ipAddress,
    port: port || 443,
    protocol: protocol || 'VLESS',
    isPrimary: isPrimary || false,
    config: config || {},
    healthStatus: 'unknown'
  });

  // If primary, unset other primaries
  if (server.isPrimary) {
    await Server.update(
      { isPrimary: false },
      { where: { id: { $ne: server.id }, isPrimary: true } }
    );
  }

  res.status(201).json({
    success: true,
    data: { server }
  });
}));

/**
 * @route   PUT /api/servers/:id
 * @desc    Update server (admin only)
 * @access  Private/Admin
 */
router.put('/:id', authenticate, authorize('admin', 'superadmin'), asyncHandler(async (req, res) => {
  const server = await Server.findByPk(req.params.id);

  if (!server) {
    return res.status(404).json({
      success: false,
      error: { code: 'SERVER_NOT_FOUND', message: 'Server not found' }
    });
  }

  const updatableFields = ['name', 'region', 'country', 'ipAddress', 'port', 'protocol', 'isActive', 'isPrimary', 'maxConnections', 'config'];
  
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
 * @route   DELETE /api/servers/:id
 * @desc    Delete server (admin only)
 * @access  Private/Admin
 */
router.delete('/:id', authenticate, authorize('superadmin'), asyncHandler(async (req, res) => {
  const server = await Server.findByPk(req.params.id);

  if (!server) {
    return res.status(404).json({
      success: false,
      error: { code: 'SERVER_NOT_FOUND', message: 'Server not found' }
    });
  }

  await server.destroy();

  res.json({
    success: true,
    message: 'Server deleted successfully'
  });
}));

/**
 * @route   POST /api/servers/:id/health
 * @desc    Update server health status
 * @access  Private/Admin
 */
router.post('/:id/health', authenticate, authorize('admin', 'superadmin'), asyncHandler(async (req, res) => {
  const { status, metrics } = req.body;
  
  const server = await Server.findByPk(req.params.id);

  if (!server) {
    return res.status(404).json({
      success: false,
      error: { code: 'SERVER_NOT_FOUND', message: 'Server not found' }
    });
  }

  await server.updateHealth(status);
  
  if (metrics) {
    server.metrics = { ...server.metrics, ...metrics };
    await server.save();
  }

  res.json({
    success: true,
    data: { server }
  });
}));

module.exports = router;
