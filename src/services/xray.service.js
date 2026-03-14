const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate VLESS configuration
 * @param {Object} options - Configuration options
 * @returns {Object} VLESS config with QR code
 */
function generateVLESSConfig(options) {
  const { uuid, server, subscription } = options;
  
  const config = {
    v: '2',
    ps: `${server.name} - ${subscription.plan.name}`,
    add: server.ipAddress,
    port: server.port.toString(),
    id: uuid,
    aid: '0',
    net: 'tcp',
    type: 'none',
    security: 'tls',
    tls: 'tls',
    sni: process.env.XRAY_TLS_DOMAIN || server.ipAddress,
    alpn: 'http/1.1',
    fp: 'chrome'
  };

  // Generate VLESS link
  const vlessLink = `vless://${uuid}@${server.ipAddress}:${server.port}?encryption=none&security=tls&type=tcp&sni=${config.sni}&alpn=http/1.1&fp=chrome#${encodeURIComponent(config.ps)}`;

  // Generate QR code
  const qrCode = QRCode.toDataURL(vlessLink);

  return {
    vless: config,
    link: vlessLink,
    qrCode: qrCode
  };
}

/**
 * Generate VLESS config for Xray server
 * @param {Object} options - Configuration options
 * @returns {Object} Xray client configuration
 */
function generateXrayClientConfig(options) {
  const { uuid, server } = options;

  return {
    protocol: 'vless',
    settings: {
      vnext: [
        {
          address: server.ipAddress,
          port: server.port,
          users: [
            {
              id: uuid,
              encryption: 'none',
              flow: 'xtls-rprx-vision'
            }
          ]
        }
      ]
    },
    streamSettings: {
      network: 'tcp',
      security: 'tls',
      tlsSettings: {
        alpn: ['http/1.1', 'h2'],
        fingerprint: 'chrome',
        serverName: process.env.XRAY_TLS_DOMAIN || server.ipAddress
      },
      sockopt: {
        dialerProxy: 'warp'
      }
    },
    mux: {
      enabled: true,
      concurrency: 8,
      xudpConcurrency: 16,
      xudpProxyUDP443: 'reject'
    }
  };
}

/**
 * Rotate VLESS UUID
 * @param {string} currentUuid - Current UUID
 * @returns {string} New UUID
 */
function rotateUuid(currentUuid) {
  // Log old UUID for tracking (optional)
  console.log(`Rotating UUID: ${currentUuid} -> ${uuidv4()}`);
  return uuidv4();
}

/**
 * Parse VLESS link
 * @param {string} link - VLESS link
 * @returns {Object|null} Parsed configuration
 */
function parseVLESSLink(link) {
  try {
    if (!link.startsWith('vless://')) {
      return null;
    }

    const url = new URL(link);
    const uuid = url.username;
    const [address, port] = url.host.split(':');
    
    const params = url.searchParams;
    
    return {
      uuid,
      address,
      port: parseInt(port),
      encryption: params.get('encryption') || 'none',
      security: params.get('security') || 'tls',
      type: params.get('type') || 'tcp',
      sni: params.get('sni'),
      alpn: params.get('alpn'),
      fp: params.get('fp'),
      name: decodeURIComponent(url.hash.slice(1))
    };
  } catch (error) {
    console.error('Error parsing VLESS link:', error);
    return null;
  }
}

module.exports = {
  generateVLESSConfig,
  generateXrayClientConfig,
  rotateUuid,
  parseVLESSLink
};
