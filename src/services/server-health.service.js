const cron = require('node-cron');
const logger = require('../config/logger');
const { Server, Subscription } = require('../models');
const deploymentService = require('./server-deployment.service');

/**
 * Server Health Monitoring Service
 * Automatically checks health of all servers
 */
class ServerHealthMonitor {
  constructor() {
    this.isRunning = false;
    this.checkInterval = 60000; // 1 minute
  }

  /**
   * Start health monitoring
   */
  start() {
    if (this.isRunning) {
      logger.warn('Health monitor is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting server health monitor...');

    // Check health every minute
    cron.schedule('* * * * *', async () => {
      await this.checkAllServers();
    });

    // Initial check
    setTimeout(() => this.checkAllServers(), 5000);

    logger.info('Server health monitor started');
  }

  /**
   * Stop health monitoring
   */
  stop() {
    this.isRunning = false;
    logger.info('Server health monitor stopped');
  }

  /**
   * Check health of all servers
   */
  async checkAllServers() {
    try {
      const servers = await Server.findAll({
        where: { isActive: true }
      });

      logger.info(`Checking health of ${servers.length} servers...`);

      const results = [];

      for (const server of servers) {
        try {
          const health = await this.checkServerHealth(server);
          results.push({
            serverId: server.id,
            name: server.name,
            ipAddress: server.ipAddress,
            ...health
          });

          // Update server metrics
          if (health.healthy) {
            await this.updateServerMetrics(server);
          }
        } catch (error) {
          logger.error(`Failed to check server ${server.name}:`, error.message);
          results.push({
            serverId: server.id,
            name: server.name,
            ipAddress: server.ipAddress,
            healthy: false,
            error: error.message
          });
        }
      }

      // Log summary
      const healthyCount = results.filter(r => r.healthy).length;
      logger.info(`Health check complete: ${healthyCount}/${results.length} servers healthy`);

      // Alert if too many servers are unhealthy
      if (healthyCount < results.length / 2) {
        logger.warn(`ALERT: More than half of servers are unhealthy! (${healthyCount}/${results.length})`);
      }

      return results;
    } catch (error) {
      logger.error('Health check failed:', error);
      return [];
    }
  }

  /**
   * Check individual server health
   */
  async checkServerHealth(server) {
    const startTime = Date.now();

    try {
      // Check API health
      const apiHealth = await this.checkAPIHealth(server);
      
      // Check Xray service
      const xrayHealth = await this.checkXrayHealth(server);

      // Check response time
      const responseTime = Date.now() - startTime;

      // Determine overall health
      let healthStatus = 'healthy';
      if (!apiHealth.healthy || !xrayHealth.healthy) {
        healthStatus = 'unhealthy';
      } else if (responseTime > 1000) {
        healthStatus = 'degraded';
      }

      // Update database
      await server.update({
        healthStatus,
        lastHealthCheck: new Date(),
        metrics: {
          ...server.metrics,
          lastResponseTime: responseTime,
          lastApiCheck: apiHealth,
          lastXrayCheck: xrayHealth
        }
      });

      return {
        healthy: healthStatus === 'healthy',
        healthStatus,
        responseTime,
        apiHealth,
        xrayHealth
      };
    } catch (error) {
      await server.update({
        healthStatus: 'unhealthy',
        lastHealthCheck: new Date()
      });

      return {
        healthy: false,
        healthStatus: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Check API health
   */
  async checkAPIHealth(server) {
    try {
      const response = await fetch(`http://${server.ipAddress}:3000/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json();
        return {
          healthy: true,
          status: response.status,
          uptime: data.uptime || 0
        };
      }

      return {
        healthy: false,
        status: response.status
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Check Xray service health
   */
  async checkXrayHealth(server) {
    try {
      // Check if port 443 is open
      const isPortOpen = await this.checkPort(server.ipAddress, 443);
      
      return {
        healthy: isPortOpen,
        port443Open: isPortOpen
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Check if port is open (simple TCP check)
   */
  async checkPort(host, port) {
    return new Promise((resolve) => {
      const net = require('net');
      const socket = new net.Socket();

      socket.setTimeout(3000);

      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.once('error', () => {
        resolve(false);
      });

      socket.once('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, host);
    });
  }

  /**
   * Update server metrics
   */
  async updateServerMetrics(server) {
    try {
      // Get active subscriptions count
      const activeSubscriptions = await Subscription.count({
        where: {
          serverId: server.id,
          isActive: true,
          endDate: { $gte: new Date() }
        }
      });

      // Update connection count
      server.currentConnections = activeSubscriptions;
      server.loadPercentage = (activeSubscriptions / server.maxConnections) * 100;

      await server.save();
    } catch (error) {
      logger.error('Failed to update server metrics:', error);
    }
  }

  /**
   * Get health statistics
   */
  async getHealthStats() {
    const servers = await Server.findAll({
      attributes: [
        'healthStatus',
        'loadPercentage',
        'currentConnections',
        'maxConnections',
        'lastHealthCheck'
      ]
    });

    const total = servers.length;
    const healthy = servers.filter(s => s.healthStatus === 'healthy').length;
    const degraded = servers.filter(s => s.healthStatus === 'degraded').length;
    const unhealthy = servers.filter(s => s.healthStatus === 'unhealthy').length;

    const avgLoad = servers.reduce((sum, s) => sum + (s.loadPercentage || 0), 0) / total || 0;

    return {
      total,
      healthy,
      degraded,
      unhealthy,
      avgLoad: avgLoad.toFixed(2),
      lastCheck: new Date()
    };
  }

  /**
   * Restart unhealthy server (auto-healing)
   */
  async restartUnhealthyServer(serverId, sshCredentials) {
    const server = await Server.findByPk(serverId);
    
    if (!server) {
      throw new Error('Server not found');
    }

    if (server.healthStatus !== 'unhealthy') {
      throw new Error('Server is not unhealthy');
    }

    try {
      const result = await deploymentService.deployServer({
        ipAddress: server.ipAddress,
        ...sshCredentials
      });

      if (result.success) {
        await server.update({
          healthStatus: 'healthy',
          lastHealthCheck: new Date()
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to restart server:', error);
      throw error;
    }
  }
}

module.exports = new ServerHealthMonitor();
