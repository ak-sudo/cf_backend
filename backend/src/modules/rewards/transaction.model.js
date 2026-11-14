const mongoose = require('mongoose');
const { REWARD_TRANSACTION_TYPES } = require('../../constants/rewards');

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for ledger entry'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Transaction amount is required'],
      validate: {
        validator(val) {
          return val !== 0;
        },
        message: 'Transaction amount cannot be zero',
      },
    },
    type: {
      type: String,
      enum: Object.values(REWARD_TRANSACTION_TYPES),
      required: [true, 'Transaction type is required'],
      index: true,
    },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
      default: null,
      index: true,
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      unique: true,
      index: true,
      trim: true,
    },
    balanceAfter: {
      type: Number,
      required: [true, 'Resulting balance snapshot is required'],
      min: [0, 'Balance cannot drop below zero'],
    },
    description: {
      type: String,
      required: [true, 'Transaction description is required'],
      trim: true,
      maxlength: 300,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable ledger: no updates allowed!
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

// Indexes
transactionSchema.index({ userId: 1, createdAt: -1 });

// Ensure idempotency for report-based rewards: cannot award same type of reward twice for one report
transactionSchema.index(
  { userId: 1, reportId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { reportId: { $type: 'objectId' } },
  }
);

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
