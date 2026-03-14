const request = require('supertest');
const app = require('../../src/index');
const { User, Plan, Subscription } = require('../../src/models');

describe('E2E: User Registration and Subscription Flow', () => {
  let authToken;
  let userId;

  describe('1. Registration', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'e2etestuser',
          email: 'e2e@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.token).toBeDefined();
      
      authToken = response.body.data.token;
      userId = response.body.data.user.id;
    });
  });

  describe('2. Get User Profile', () => {
    it('should get user profile', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user.email).toBe('e2e@example.com');
    });
  });

  describe('3. Get Available Plans', () => {
    it('should get all available plans', async () => {
      const response = await request(app)
        .get('/api/plans');

      expect(response.status).toBe(200);
      expect(response.body.data.plans).toBeDefined();
      expect(response.body.data.plans.length).toBeGreaterThan(0);
    });
  });

  describe('4. Check Balance', () => {
    it('should get user balance', async () => {
      const response = await request(app)
        .get('/api/users/balance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.balance).toBeDefined();
    });
  });

  describe('5. Try to activate subscription without balance', () => {
    it('should fail due to insufficient balance', async () => {
      const plans = await Plan.findAll({ where: { isActive: true } });
      const plan = plans[0];

      const response = await request(app)
        .post('/api/subscriptions/activate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId: plan.id });

      expect(response.status).toBe(402);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_BALANCE');
    });
  });

  describe('6. Simulate Payment (add balance)', () => {
    it('should add balance to user', async () => {
      const user = await User.findByPk(userId);
      user.balance = 1000; // Add 1000 RUB
      await user.save();

      const response = await request(app)
        .get('/api/users/balance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.body.data.balance).toBe('1000.00');
    });
  });

  describe('7. Activate Subscription', () => {
    it('should activate subscription', async () => {
      const plans = await Plan.findAll({ where: { isActive: true } });
      const plan = plans.find(p => p.price <= 1000) || plans[0];

      const response = await request(app)
        .post('/api/subscriptions/activate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId: plan.id });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subscription).toBeDefined();
      expect(response.body.data.subscription.planId).toBe(plan.id);
    });
  });

  describe('8. Get Active Subscription', () => {
    it('should get active subscription', async () => {
      const response = await request(app)
        .get('/api/subscriptions/active')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.subscription).toBeDefined();
      expect(response.body.data.subscription.isActive).toBe(true);
    });
  });

  describe('9. Get VPN Configuration', () => {
    it('should get VLESS configuration', async () => {
      const response = await request(app)
        .get('/api/subscriptions/config')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.vless).toBeDefined();
      expect(response.body.data.link).toBeDefined();
      expect(response.body.data.qrCode).toBeDefined();
    });
  });

  describe('10. Get Referrals', () => {
    it('should get referral information', async () => {
      const response = await request(app)
        .get('/api/users/referrals')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.refCode).toBeDefined();
      expect(response.body.data.refLink).toBeDefined();
    });
  });
});
