const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor ID is required for audit record'],
      index: true,
    },
    actorEmail: {
      type: String,
      trim: true,
      default: '',
    },
    actorRole: {
      type: String,
      required: [true, 'Actor role is required'],
      index: true,
    },
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      index: true,
    },
    targetResource: {
      type: String,
      required: true,
      index: true,
    },
    targetId: {
      type: String,
      index: true,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable audit records
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

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
