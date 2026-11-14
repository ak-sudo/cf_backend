const mongoose = require('mongoose');
const { NOTIFICATION_TYPES } = require('../../constants/notifications');

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient User ID is required'],
      index: true,
    },
    recipientFirebaseUid: {
      type: String,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      required: [true, 'Notification type is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: 150,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: 500,
    },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
      default: null,
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
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

// Compound index for querying user notifications sorted by recency
notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
