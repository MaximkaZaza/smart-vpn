/**
 * Database Seed Script - Initial Data
 */

const { Plan, Server, User } = require('../models');

async function seed() {
  try {
    console.log('Starting database seeding...');

    // Create default plans
    const plans = await Promise.all([
      Plan.findOrCreate({
        where: { name: 'Стартовый' },
        defaults: {
          description: 'Базовый тариф для начала работы',
          price: 299,
          currency: 'RUB',
          duration: '1month',
          durationDays: 30,
          trafficLimitGB: 50,
          deviceLimit: 1,
          isPopular: false,
          sortOrder: 1
        }
      }),
      Plan.findOrCreate({
        where: { name: 'Оптимальный' },
        defaults: {
          description: 'Популярный тариф с лучшим соотношением цены и качества',
          price: 799,
          currency: 'RUB',
          duration: '3months',
          durationDays: 90,
          trafficLimitGB: 200,
          deviceLimit: 2,
          isPopular: true,
          sortOrder: 2
        }
      }),
      Plan.findOrCreate({
        where: { name: 'Продвинутый' },
        defaults: {
          description: 'Для активных пользователей',
          price: 1499,
          currency: 'RUB',
          duration: '6months',
          durationDays: 180,
          trafficLimitGB: 500,
          deviceLimit: 3,
          isPopular: false,
          sortOrder: 3
        }
      }),
      Plan.findOrCreate({
        where: { name: 'Безлимитный' },
        defaults: {
          description: 'Максимальные возможности',
          price: 2499,
          currency: 'RUB',
          duration: '1year',
          durationDays: 365,
          trafficLimitGB: 1000,
          deviceLimit: 5,
          isPopular: false,
          sortOrder: 4
        }
      })
    ]);

    console.log('✓ Plans created/updated');

    // Create default server
    const [server] = await Server.findOrCreate({
      where: { name: 'Main Server' },
      defaults: {
        region: 'Europe',
        country: 'Netherlands',
        ipAddress: process.env.VPN_SERVER_IP || '0.0.0.0',
        port: 443,
        protocol: 'VLESS',
        isPrimary: true,
        healthStatus: 'unknown',
        maxConnections: 1000,
        config: {
          encryption: 'none',
          security: 'tls',
          network: 'tcp'
        }
      }
    });

    console.log('✓ Default server created');

    // Create admin user if not exists
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@vpn.local';
    const [admin] = await User.findOrCreate({
      where: { email: adminEmail },
      defaults: {
        username: 'admin',
        role: 'admin',
        balance: 0
      }
    });

    if (admin && !admin.passwordHash) {
      const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
      await admin.setPassword(defaultPassword);
      await admin.save();
      console.log('✓ Admin user created with default password');
    }

    console.log('\n✅ Seeding completed successfully!');
    console.log('\nDefault credentials:');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${process.env.ADMIN_PASSWORD || 'admin123'}`);
    console.log('\n⚠️  Change the default password immediately!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

seed();
