const ssh2 = require('ssh2');
const logger = require('../config/logger');
const { Server } = require('../models');

/**
 * Server Deployment Service
 * Handles automatic deployment of Xray VPN servers
 */
class ServerDeploymentService {
  constructor() {
    this.connections = new Map();
  }

  /**
   * Connect to server via SSH
   * @param {string} host - Server IP
   * @param {string} username - SSH username
   * @param {string} password|privateKey - SSH credentials
   * @returns {Promise}
   */
  async connectSSH(host, username, password = null, privateKey = null) {
    return new Promise((resolve, reject) => {
      const conn = new ssh2.Client();
      
      const config = {
        host,
        port: 22,
        username,
        readyTimeout: 30000,
      };

      if (privateKey) {
        config.privateKey = privateKey;
      } else if (password) {
        config.password = password;
      }

      conn.on('ready', () => {
        logger.info(`SSH connected to ${host}`);
        resolve(conn);
      });

      conn.on('error', (err) => {
        logger.error(`SSH connection failed to ${host}:`, err.message);
        reject(err);
      });

      conn.connect(config);
    });
  }

  /**
   * Execute command on remote server
   * @param {object} conn - SSH connection
   * @param {string} command - Command to execute
   * @returns {Promise}
   */
  async execCommand(conn, command) {
    return new Promise((resolve, reject) => {
      conn.exec(command, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        let stdout = '';
        let stderr = '';

        stream.on('close', (code) => {
          if (code === 0) {
            resolve(stdout.trim());
          } else {
            reject(new Error(`Command failed with code ${code}: ${stderr}`));
          }
        });

        stream.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        stream.on('data', (data) => {
          stdout += data.toString();
        });
      });
    });
  }

  /**
   * Deploy Xray server
   * @param {object} serverData - Server configuration
   * @returns {Promise}
   */
  async deployServer(serverData) {
    const {
      ipAddress,
      username = 'root',
      password,
      privateKey,
      sshPort = 22
    } = serverData;

    let conn;

    try {
      logger.info(`Starting deployment on ${ipAddress}`);

      // Connect via SSH
      conn = await this.connectSSH(ipAddress, username, password, privateKey);

      // Update system
      await this.execCommand(conn, 'apt-get update && apt-get upgrade -y');

      // Install Docker if not installed
      const dockerCheck = await this.execCommand(conn, 'docker --version 2>/dev/null || echo "not installed"');
      if (dockerCheck.includes('not installed')) {
        logger.info('Installing Docker...');
        await this.execCommand(conn, 'curl -fsSL https://get.docker.com | sh');
      }

      // Create directories
      await this.execCommand(conn, 'mkdir -p /opt/xray /opt/xray/config /opt/xray/certs');

      // Generate Xray configuration
      const xrayConfig = this.generateXrayConfig(serverData);
      await this.execCommand(conn, `cat > /opt/xray/config/config.json << 'EOF'
${JSON.stringify(xrayConfig, null, 2)}
EOF`);

      // Create Docker Compose file
      const dockerCompose = this.generateDockerCompose(serverData);
      await this.execCommand(conn, `cat > /opt/xray/docker-compose.yml << 'EOF'
${dockerCompose}
EOF`);

      // Download and start Xray
      await this.execCommand(conn, 'cd /opt/xray && docker-compose up -d');

      // Install Nginx for reverse proxy
      await this.execCommand(conn, 'apt-get install -y nginx');

      // Configure Nginx
      const nginxConfig = this.generateNginxConfig(serverData);
      await this.execCommand(conn, `cat > /etc/nginx/sites-available/xray << 'EOF'
${nginxConfig}
EOF`);

      await this.execCommand(conn, 'ln -sf /etc/nginx/sites-available/xray /etc/nginx/sites-enabled/');
      await this.execCommand(conn, 'nginx -t && systemctl restart nginx');

      // Setup firewall
      await this.execCommand(conn, 'ufw allow 22/tcp');
      await this.execCommand(conn, 'ufw allow 80/tcp');
      await this.execCommand(conn, 'ufw allow 443/tcp');
      await this.execCommand(conn, 'ufw allow 443/udp');
      await this.execCommand(conn, 'echo "y" | ufw enable');

      // Install SSL certificate (Let's Encrypt)
      if (serverData.domain) {
        await this.execCommand(conn, 'apt-get install -y certbot python3-certbot-nginx');
        await this.execCommand(conn, `certbot --nginx -d ${serverData.domain} --non-interactive --agree-tos --email ${serverData.adminEmail || 'admin@localhost'}`);
      }

      // Health check
      await this.execCommand(conn, 'sleep 5 && curl -f http://localhost:3000/health || echo "API not ready"');

      logger.info(`Deployment completed on ${ipAddress}`);

      return {
        success: true,
        message: 'Server deployed successfully',
        server: serverData
      };

    } catch (error) {
      logger.error('Deployment failed:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      if (conn) {
        conn.end();
      }
    }
  }

  /**
   * Generate Xray configuration
   */
  generateXrayConfig(serverData) {
    return {
      log: {
        loglevel: 'warning',
        access: '/var/log/xray/access.log',
        error: '/var/log/xray/error.log'
      },
      api: {
        services: ['HandlerService', 'LoggerService', 'StatsService'],
        tag: 'api'
      },
      stats: {},
      inbounds: [
        {
          tag: 'vless-in',
          port: 443,
          protocol: 'vless',
          settings: {
            clients: [],
            decryption: 'none',
            fallbacks: [
              {
                dest: 80,
                xver: 1
              }
            ]
          },
          streamSettings: {
            network: 'tcp',
            security: 'tls',
            tlsSettings: {
              alpn: ['http/1.1', 'h2'],
              certificates: [
                {
                  certificateFile: '/opt/xray/certs/fullchain.pem',
                  keyFile: '/opt/xray/certs/privkey.pem',
                  ocspStapling: 3600
                }
              ],
              minVersion: '1.2'
            }
          },
          sniffing: {
            enabled: true,
            destOverride: ['http', 'tls', 'quic']
          }
        },
        {
          tag: 'api',
          listen: '127.0.0.1',
          port: 10085,
          protocol: 'dokodemo-door',
          settings: {
            address: '127.0.0.1'
          }
        }
      ],
      outbounds: [
        {
          tag: 'direct',
          protocol: 'freedom',
          settings: {}
        },
        {
          tag: 'blocked',
          protocol: 'blackhole',
          settings: {}
        }
      ],
      routing: {
        domainStrategy: 'AsIs',
        rules: [
          {
            type: 'field',
            inboundTag: ['api'],
            outboundTag: 'api'
          },
          {
            type: 'field',
            outboundTag: 'blocked',
            ip: ['geoip:private']
          }
        ]
      },
      policy: {
        levels: {
          0: {
            handshake: 4,
            connIdle: 300,
            statsUserUplink: true,
            statsUserDownlink: true
          }
        }
      }
    };
  }

  /**
   * Generate Docker Compose file
   */
  generateDockerCompose(serverData) {
    return `version: '3.8'

services:
  xray:
    image: teddysun/xray:latest
    container_name: xray
    ports:
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./config:/etc/xray
      - ./certs:/etc/certs
    restart: unless-stopped
    networks:
      - xray_network

  api:
    image: node:18-alpine
    container_name: xray-api
    working_dir: /app
    command: node src/index.js
    volumes:
      - /opt/xray/api:/app
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DB_HOST=${serverData.dbHost || 'localhost'}
      - DB_PORT=5432
      - DB_NAME=vpn_db
      - DB_USER=vpn_user
      - DB_PASSWORD=${serverData.dbPassword}
    restart: unless-stopped
    depends_on:
      - xray
    networks:
      - xray_network

networks:
  xray_network:
    driver: bridge
`;
  }

  /**
   * Generate Nginx configuration
   */
  generateNginxConfig(serverData) {
    return `server {
    listen 80;
    server_name ${serverData.domain || '_'};

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}`;
  }

  /**
   * Add client to Xray server
   * @param {string} serverIp - Server IP
   * @param {string} clientUuid - Client UUID
   * @param {string} sshCredentials - SSH credentials
   */
  async addClientToServer(serverIp, clientUuid, sshCredentials) {
    let conn;

    try {
      conn = await this.connectSSH(serverIp, sshCredentials.username, sshCredentials.password);

      // Get current config
      const configStr = await this.execCommand(conn, 'cat /opt/xray/config/config.json');
      const config = JSON.parse(configStr);

      // Add client to inbound
      const vlessInbound = config.inbounds.find(i => i.protocol === 'vless');
      if (vlessInbound) {
        vlessInbound.settings.clients.push({
          id: clientUuid,
          flow: 'xtls-rprx-vision',
          email: `client_${clientUuid}`
        });
      }

      // Update config
      await this.execCommand(conn, `cat > /opt/xray/config/config.json << 'EOF'
${JSON.stringify(config, null, 2)}
EOF`);

      // Restart Xray
      await this.execCommand(conn, 'cd /opt/xray && docker-compose restart xray');

      logger.info(`Client ${clientUuid} added to server ${serverIp}`);
      return { success: true };

    } catch (error) {
      logger.error('Failed to add client:', error);
      return { success: false, error: error.message };
    } finally {
      if (conn) conn.end();
    }
  }

  /**
   * Remove client from Xray server
   */
  async removeClientFromServer(serverIp, clientUuid, sshCredentials) {
    let conn;

    try {
      conn = await this.connectSSH(serverIp, sshCredentials.username, sshCredentials.password);

      const configStr = await this.execCommand(conn, 'cat /opt/xray/config/config.json');
      const config = JSON.parse(configStr);

      const vlessInbound = config.inbounds.find(i => i.protocol === 'vless');
      if (vlessInbound) {
        vlessInbound.settings.clients = vlessInbound.settings.clients.filter(
          c => c.id !== clientUuid
        );
      }

      await this.execCommand(conn, `cat > /opt/xray/config/config.json << 'EOF'
${JSON.stringify(config, null, 2)}
EOF`);

      await this.execCommand(conn, 'cd /opt/xray && docker-compose restart xray');

      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      if (conn) conn.end();
    }
  }

  /**
   * Check server health
   */
  async checkServerHealth(server) {
    try {
      const response = await fetch(`http://${server.ipAddress}:3000/health`, {
        timeout: 5000
      });

      if (response.ok) {
        await Server.update(
          { healthStatus: 'healthy', lastHealthCheck: new Date() },
          { where: { id: server.id } }
        );
        return { healthy: true };
      }
    } catch (error) {
      await Server.update(
        { healthStatus: 'unhealthy', lastHealthCheck: new Date() },
        { where: { id: server.id } }
      );
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Deploy multiple servers
   */
  async deployMultipleServers(serversData) {
    const results = [];

    for (const serverData of serversData) {
      try {
        const result = await this.deployServer(serverData);
        results.push({
          server: serverData.name,
          ...result
        });
      } catch (error) {
        results.push({
          server: serverData.name,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = new ServerDeploymentService();
