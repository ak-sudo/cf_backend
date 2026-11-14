const mongoose = require('mongoose');
const { DEPARTMENTS } = require('../../constants/roles');
const {
  ISSUE_CATEGORIES,
  REPORT_STATUSES,
  SEVERITY_LEVELS,
  AI_PROCESSING_STATUS,
} = require('../../constants/reports');

const reportImageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    publicId: {
      type: String,
      trim: true,
      default: '',
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    // [Longitude, Latitude] in strict GeoJSON format
    coordinates: {
      type: [Number],
      required: [true, 'Geospatial coordinates [longitude, latitude] are required'],
      validate: {
        validator(coords) {
          if (!Array.isArray(coords) || coords.length !== 2) return false;
          const [lng, lat] = coords;
          return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
        },
        message: 'Coordinates must be valid [longitude (-180..180), latitude (-90..90)]',
      },
    },
    address: { type: String, trim: true, default: '' },
    landmark: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    postalCode: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const aiAnalysisSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(AI_PROCESSING_STATUS),
      default: AI_PROCESSING_STATUS.PENDING,
      index: true,
    },
    predictedCategory: { type: String, default: null },
    recommendedDepartment: { type: String, default: null },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    estimatedSeverity: {
      type: String,
      enum: [...Object.values(SEVERITY_LEVELS), null],
      default: null,
    },
    fraudScore: { type: Number, min: 0, max: 1, default: 0 },
    tags: [{ type: String }],
    processedAt: { type: Date, default: null },
    modelVersion: { type: String, default: 'gemma-4-civic-vision' },
    reviewReason: { type: String, default: null },
    aiReport: {
      summary: { type: String, default: '' },
      keyObservations: [{ type: String }],
      immediateHazards: [{ type: String }],
      recommendedAction: { type: String, default: '' },
      estimatedRepairUrgency: { type: String, default: 'STANDARD' },
    },
  },
  { _id: false }
);

const resolutionProofSchema = new mongoose.Schema(
  {
    images: [{ type: String, trim: true }],
    notes: { type: String, trim: true, default: '' },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedByAdmin: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
  },
  { _id: false }
);

const reportSchema = new mongoose.Schema(
  {
    citizenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Citizen ID is required'],
      index: true,
    },
    citizenFirebaseUid: {
      type: String,
      required: [true, 'Citizen Firebase UID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Report title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Report description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    category: {
      type: String,
      enum: Object.values(ISSUE_CATEGORIES),
      default: ISSUE_CATEGORIES.OTHER,
      index: true,
    },
    department: {
      type: String,
      enum: DEPARTMENTS,
      default: 'GENERAL',
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(REPORT_STATUSES),
      default: REPORT_STATUSES.SUBMITTED,
      index: true,
    },
    severity: {
      type: String,
      enum: Object.values(SEVERITY_LEVELS),
      default: SEVERITY_LEVELS.LOW,
      index: true,
    },
    location: {
      type: pointSchema,
      required: true,
    },
    images: {
      type: [reportImageSchema],
      validate: {
        validator(val) {
          return Array.isArray(val) && val.length > 0 && val.length <= 5;
        },
        message: 'Reports must include between 1 and 5 verified images',
      },
    },
    aiAnalysis: {
      type: aiAnalysisSchema,
      default: () => ({}),
    },
    assignedWorkerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    resolutionProof: {
      type: resolutionProofSchema,
      default: () => ({}),
    },
    ecoCoinsAwarded: {
      type: Number,
      default: 0,
      min: 0,
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

// Strategic Indexes for CivicFlow Query Patterns
reportSchema.index({ location: '2dsphere' });
reportSchema.index({ status: 1, department: 1, createdAt: -1 });
reportSchema.index({ citizenId: 1, createdAt: -1 });
reportSchema.index({ assignedWorkerId: 1, status: 1 });
reportSchema.index({ category: 1, status: 1 });

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;
