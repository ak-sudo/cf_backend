const mongoose = require('mongoose');
const { ROLES, DEPARTMENTS } = require('../../constants/roles');

const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: [true, 'Firebase UID is required'],
      unique: true,
      index: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    displayName: {
      type: String,
      trim: true,
      default: '',
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: '',
    },
    photoURL: {
      type: String,
      trim: true,
      default: '',
    },
    role: {
      type: String,
      enum: {
        values: Object.values(ROLES),
        message: 'Invalid user role: {VALUE}',
      },
      default: ROLES.CITIZEN,
      index: true,
    },
    department: {
      type: String,
      enum: {
        values: [...DEPARTMENTS, null],
        message: 'Invalid department: {VALUE}',
      },
      default: null,
      index: true,
      validate: {
        validator(val) {
          // If role is ADMIN or WORKER, department is required
          if ((this.role === ROLES.ADMIN || this.role === ROLES.WORKER) && !val) {
            return false;
          }
          return true;
        },
        message: 'Department is required for ADMIN and WORKER roles',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    ecoCoins: {
      type: Number,
      default: 0,
      min: [0, 'EcoCoins cannot be negative'],
    },
    stats: {
      reportsSubmitted: { type: Number, default: 0, min: 0 },
      reportsResolved: { type: Number, default: 0, min: 0 },
      tasksAssigned: { type: Number, default: 0, min: 0 },
      tasksCompleted: { type: Number, default: 0, min: 0 },
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
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
    toObject: {
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

// Compound indexes for querying and dashboard filtering
userSchema.index({ role: 1, department: 1 });
userSchema.index({ role: 1, isActive: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
