const request = require('supertest');
const app = require('../src/index');
const { User, Plan } = require('../src/models');

describe('API Routes', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    // Create test user
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      balance: 1000
    });
    await testUser.setPassword('password123');
    await testUser.save();

    // Create test plan
    await Plan.create({
      name: 'Test Plan',
      price: 500,
      currency: 'RUB',
      duration: '1month',
      durationDays: 30,
      trafficLimitGB: 100,
      deviceLimit: 1,
      isActive: true
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });

  describe('Authentication', () => {
    describe('POST /api/auth/login', () => {
      it('should login with valid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password123'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.token).toBeDefined();
        
        authToken = response.body.data.token;
      });

      it('should reject invalid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/auth/register', () => {
      it('should register new user', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'newuser',
            email: 'newuser@example.com',
            password: 'password123'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.token).toBeDefined();
      });

      it('should reject duplicate email', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'duplicateuser',
            email: 'test@example.com',
            password: 'password123'
          });

        expect(response.status).toBe(409);
        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Protected Routes', () => {
    beforeAll(() => {
      if (!authToken) {
        throw new Error('Auth token not obtained');
      }
    });

    describe('GET /api/users/me', () => {
      it('should return user profile', async () => {
        const response = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user).toBeDefined();
        expect(response.body.data.user.email).toBe('test@example.com');
      });

      it('should reject unauthenticated request', async () => {
        const response = await request(app)
          .get('/api/users/me');

        expect(response.status).toBe(401);
      });
    });

    describe('GET /api/plans', () => {
      it('should return all active plans', async () => {
        const response = await request(app)
          .get('/api/plans');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.plans).toBeDefined();
        expect(response.body.data.plans.length).toBeGreaterThan(0);
      });
    });

    describe('GET /api/users/balance', () => {
      it('should return user balance', async () => {
        const response = await request(app)
          .get('/api/users/balance')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.balance).toBeDefined();
      });
    });
  });

  describe('Metrics', () => {
    it('should return Prometheus metrics', async () => {
      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
    });
  });
});
