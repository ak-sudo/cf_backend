const RewardItem = require('./reward-item.model');
const { REWARD_ITEM_CATEGORIES } = require('../../constants/rewards');
const logger = require('../../utils/logger');

/**
 * Dummy civic perks used to initialize the rewards catalog in development.
 * Partners are fictional placeholders - replace with real partner data before launch.
 */
const DUMMY_REWARDS = Object.freeze([
  {
    slug: 'metro-day-pass',
    title: 'Metro Day Pass',
    description: 'Unlimited rides on city metro and feeder buses for one full day.',
    costCoins: 50,
    category: REWARD_ITEM_CATEGORIES.PUBLIC_TRANSIT,
    partnerName: 'City Transit Authority',
    stock: -1,
    terms: 'Valid for 30 days from redemption. One pass per voucher. Non-transferable.',
  },
  {
    slug: 'bike-share-week',
    title: 'Bike Share – 7 Day Membership',
    description: 'Seven days of free 30-minute rides at any public bike-share dock.',
    costCoins: 120,
    category: REWARD_ITEM_CATEGORIES.PUBLIC_TRANSIT,
    partnerName: 'GreenWheels Bike Share',
    stock: 200,
    terms: 'Activate within 14 days of redemption. Rides beyond 30 minutes are billed normally.',
  },
  {
    slug: 'electricity-bill-5pct',
    title: '5% Off Electricity Bill',
    description: 'One-time 5% discount (up to ₹250) on your next household electricity bill.',
    costCoins: 200,
    category: REWARD_ITEM_CATEGORIES.UTILITY_DISCOUNT,
    partnerName: 'Municipal Power Utility',
    stock: 500,
    terms: 'Applies to residential connections only. Maximum one redemption per billing cycle.',
  },
  {
    slug: 'water-bill-credit',
    title: '₹100 Water Bill Credit',
    description: 'A flat ₹100 credit applied to your next municipal water bill.',
    costCoins: 150,
    category: REWARD_ITEM_CATEGORIES.UTILITY_DISCOUNT,
    partnerName: 'City Water Board',
    stock: 300,
    terms: 'Credit is applied within two billing cycles. Not redeemable for cash.',
  },
  {
    slug: 'sapling-kit',
    title: 'Plant-a-Tree Sapling Kit',
    description: 'A native sapling, compost and planting guide, collected from your ward office.',
    costCoins: 80,
    category: REWARD_ITEM_CATEGORIES.ENVIRONMENT,
    partnerName: 'Urban Forest Initiative',
    stock: 150,
    terms: 'Collect within 21 days from your registered ward office with the voucher code.',
  },
  {
    slug: 'compost-bin',
    title: 'Home Compost Bin',
    description: 'A 20-litre kitchen compost bin to turn household waste into fertilizer.',
    costCoins: 250,
    category: REWARD_ITEM_CATEGORIES.ENVIRONMENT,
    partnerName: 'Zero Waste Collective',
    stock: 75,
    terms: 'One bin per household. Delivery within city limits only.',
  },
  {
    slug: 'museum-family-pass',
    title: 'City Museum Family Pass',
    description: 'Free entry for up to four people at the city heritage museum.',
    costCoins: 100,
    category: REWARD_ITEM_CATEGORIES.COMMUNITY,
    partnerName: 'City Heritage Museum',
    stock: -1,
    terms: 'Valid on any day except public holidays. Expires 60 days after redemption.',
  },
  {
    slug: 'civic-champion-badge',
    title: 'Civic Champion Certificate',
    description: 'A signed certificate recognizing your contribution to a cleaner, safer city.',
    costCoins: 500,
    category: REWARD_ITEM_CATEGORIES.COMMUNITY,
    partnerName: 'Office of the Municipal Commissioner',
    stock: 50,
    terms: 'Certificates are issued at the monthly ward meeting.',
  },
]);

/**
 * Idempotently inserts any dummy rewards that are missing (matched by slug).
 * Existing items are never modified, so admin edits to price/stock survive re-runs.
 */
async function seedRewardCatalog({ items = DUMMY_REWARDS } = {}) {
  const ops = items.map((item) => ({
    updateOne: {
      filter: { slug: item.slug },
      update: { $setOnInsert: { ...item, isActive: true } },
      upsert: true,
    },
  }));

  const result = await RewardItem.bulkWrite(ops, { ordered: false });
  const inserted = result.upsertedCount || 0;

  logger.info({ inserted, total: items.length }, 'Reward catalog seed complete');
  return { inserted, total: items.length };
}

module.exports = {
  DUMMY_REWARDS,
  seedRewardCatalog,
};
