/**
 * Seeds the dummy rewards catalog: `npm run seed:rewards`
 * Idempotent - inserts only missing items (matched by slug), never overwrites.
 */
require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { seedRewardCatalog } = require('../modules/rewards/reward.seed');
const logger = require('../utils/logger');

(async () => {
  try {
    await connectDB();
    const { inserted, total } = await seedRewardCatalog();
    logger.info(`Reward catalog: ${inserted} inserted, ${total - inserted} already present`);
    await disconnectDB();
    process.exit(0);
  } catch (err) {
    logger.error({ err: err.message }, 'Reward catalog seeding failed');
    process.exit(1);
  }
})();
