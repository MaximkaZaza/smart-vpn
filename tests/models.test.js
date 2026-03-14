const { User, Subscription, Plan } = require('../src/models');

describe('Models', () => {
  describe('User', () => {
    let user;

    beforeEach(async () => {
      user = await User.create({
        username: 'testuser',
        email: 'test@example.com'
      });
      await user.setPassword('password123');
      await user.save();
    });

    it('should create user with refCode', async () => {
      expect(user.refCode).toBeDefined();
      expect(user.refCode).toMatch(/^ref_/);
    });

    it('should validate password correctly', async () => {
      const isValid = await user.validatePassword('password123');
      expect(isValid).toBe(true);

      const isInvalid = await user.validatePassword('wrongpassword');
      expect(isInvalid).toBe(false);
    });

    it('should not store plain text password', async () => {
      expect(user.passwordHash).not.toBe('password123');
      expect(user.passwordHash).toMatch(/^\$2[ayb]\$.{56}$/);
    });

    it('should generate unique refCode', async () => {
      const anotherUser = await User.create({
        username: 'anotheruser',
        email: 'another@example.com'
      });

      expect(anotherUser.refCode).not.toBe(user.refCode);
    });
  });

  describe('Subscription', () => {
    let user, plan, subscription;

    beforeEach(async () => {
      user = await User.create({
        username: 'subuser',
        email: 'sub@example.com'
      });

      plan = await Plan.create({
        name: 'Test Plan',
        price: 500,
        currency: 'RUB',
        duration: '1month',
        durationDays: 30,
        trafficLimitGB: 100,
        deviceLimit: 1,
        isActive: true
      });

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      subscription = await Subscription.create({
        userId: user.id,
        planId: plan.id,
        endDate,
        trafficLimitGB: 100,
        deviceLimit: 1
      });
    });

    it('should check if subscription is active', () => {
      expect(subscription.isActiveSubscription()).toBe(true);
    });

    it('should calculate remaining days', () => {
      const days = subscription.getRemainingDays();
      expect(days).toBeGreaterThan(0);
      expect(days).toBeLessThanOrEqual(30);
    });

    it('should have unique vlessUuid', () => {
      expect(subscription.vlessUuid).toBeDefined();
    });
  });

  describe('Plan', () => {
    let plan;

    beforeEach(async () => {
      plan = await Plan.create({
        name: 'Monthly Plan',
        price: 500,
        currency: 'RUB',
        duration: '1month',
        durationDays: 30,
        trafficLimitGB: 100,
        deviceLimit: 1,
        isActive: true
      });
    });

    it('should get duration days from duration enum', () => {
      expect(plan.getDurationDays()).toBe(30);
    });

    it('should use durationDays if duration is custom', async () => {
      const customPlan = await Plan.create({
        name: 'Custom Plan',
        price: 1000,
        currency: 'RUB',
        duration: '1month',
        durationDays: 45,
        trafficLimitGB: 200,
        deviceLimit: 2,
        isActive: true
      });

      expect(customPlan.getDurationDays()).toBe(45);
    });
  });
});
