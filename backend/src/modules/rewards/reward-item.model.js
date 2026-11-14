const mongoose = require('mongoose');
const { REWARD_ITEM_CATEGORIES } = require('../../constants/rewards');

const rewardItemSchema = new mongoose.Schema(
  {
    // Stable identifier for catalog seeding: lets the seeder insert missing
    // items without duplicating or overwriting admin-edited ones.
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      maxlength: 80,
    },
    title: {
      type: String,
      required: [true, 'Reward title is required'],
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      required: [true, 'Reward description is required'],
      trim: true,
      maxlength: 500,
    },
    costCoins: {
      type: Number,
      required: [true, 'Cost in EcoCoins is required'],
      min: [1, 'Cost must be at least 1 EcoCoin'],
    },
    category: {
      type: String,
      enum: Object.values(REWARD_ITEM_CATEGORIES),
      default: REWARD_ITEM_CATEGORIES.COMMUNITY,
      index: true,
    },
    partnerName: {
      type: String,
      required: [true, 'Civic partner name is required'],
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    stock: {
      type: Number,
      default: -1, // -1 means unlimited
      min: [-1, 'Stock must be -1 (unlimited) or a non-negative count'],
      validate: {
        validator: Number.isInteger,
        message: 'Stock must be an integer',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    terms: {
      type: String,
      trim: true,
      default: 'Redeemable per account. Non-transferable.',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

rewardItemSchema.index({ isActive: 1, costCoins: 1 });

const RewardItem = mongoose.model('RewardItem', rewardItemSchema);

module.exports = RewardItem;
