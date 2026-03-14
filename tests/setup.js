const { sequelize } = require('../src/models');

beforeAll(async () => {
  // Connect to test database
  await sequelize.authenticate();
});

afterAll(async () => {
  // Close database connection
  await sequelize.close();
});

// Clear database before each test
beforeEach(async () => {
  await sequelize.sync({ force: true });
});
