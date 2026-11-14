const Report = require('./report.model');
const User = require('../users/user.model');
const { ROLES } = require('../../constants/roles');
const {
  REPORT_STATUSES,
  CATEGORY_DEPARTMENT_MAP,
  REWARD_POINTS,
  SEVERITY_LEVELS,
} = require('../../constants/reports');
const {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} = require('../../utils/errors');
const { scheduleReportAnalysis } = require('../../queues/report-queue');
const { generateUploadSignature } = require('../../config/cloudinary');
const notificationService = require('../notifications/notification.service');
const { NOTIFICATION_TYPES } = require('../../constants/notifications');
const logger = require('../../utils/logger');

class ReportService {
  /**
   * Generates a signed Cloudinary upload signature for client-side direct upload
   */
  generateUploadSignature(user) {
    return generateUploadSignature(user._id.toString());
  }

  /**
   * Submit a new civic issue report
   */
  async createReport(citizenUser, reportData) {
    const {
      title,
      description,
      category,
      coordinates,
      address,
      landmark,
      city,
      postalCode,
      images,
    } = reportData;

    // Determine default department based on reported category
    const initialDepartment = CATEGORY_DEPARTMENT_MAP[category] || 'GENERAL';

    const report = await Report.create({
      citizenId: citizenUser._id,
      citizenFirebaseUid: citizenUser.firebaseUid,
      title,
      description,
      category,
      department: initialDepartment,
      status: REPORT_STATUSES.SUBMITTED,
      severity: SEVERITY_LEVELS.LOW,
      location: {
        type: 'Point',
        coordinates,
        address: address || '',
        landmark: landmark || '',
        city: city || '',
        postalCode: postalCode || '',
      },
      images: images.map((img) => ({
        url: img.url,
        publicId: img.publicId || '',
        uploadedAt: new Date(),
      })),
    });

    // Increment citizen stats non-blocking
    User.findByIdAndUpdate(citizenUser._id, {
      $inc: { 'stats.reportsSubmitted': 1 },
    }).catch((err) => {
      logger.error({ err: err.message, userId: citizenUser._id }, 'Failed to increment citizen report stats');
    });

    // Schedule background AI analysis without blocking response
    scheduleReportAnalysis(report).catch((err) => {
      logger.error({ err: err.message, reportId: report._id }, 'Async AI scheduling error');
    });

    // Asynchronously notify citizen of successful submission
    notificationService.createNotification({
      recipientId: citizenUser._id,
      recipientFirebaseUid: citizenUser.firebaseUid,
      type: NOTIFICATION_TYPES.REPORT_SUBMITTED,
      title: 'Report Logged',
      message: `Your report "${report.title}" has been successfully submitted and scheduled for AI analysis.`,
      reportId: report._id,
    });

    logger.info(
      {
        reportId: report._id,
        citizenId: citizenUser._id,
        category: report.category,
        department: report.department,
      },
      'Civic issue report created successfully'
    );

    return report;
  }

  /**
   * List reports with RBAC scope, optional geospatial search, and pagination
   */
  async listReports(caller, query) {
    const {
      page,
      limit,
      status,
      category,
      department,
      severity,
      assignedWorkerId,
      citizenId,
      longitude,
      latitude,
      radiusMeters,
    } = query;

    const filter = {};

    // RBAC Scope Isolation
    if (caller.role === ROLES.CITIZEN) {
      // Citizens by default see their own reports
      filter.citizenId = caller._id;
    } else if (caller.role === ROLES.ADMIN) {
      // Admins are locked to their department
      filter.department = caller.department;
    } else if (caller.role === ROLES.WORKER) {
      // Workers view tasks assigned to them or in their department
      if (assignedWorkerId) {
        filter.assignedWorkerId = caller._id;
      } else {
        filter.department = caller.department;
      }
    } else if (caller.role === ROLES.SUPER_ADMIN) {
      // Super Admin has global oversight
      if (department) filter.department = department;
      if (citizenId) filter.citizenId = citizenId;
    }

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (severity) filter.severity = severity;
    if (assignedWorkerId && caller.role !== ROLES.CITIZEN) {
      filter.assignedWorkerId = assignedWorkerId;
    }

    // Geospatial Radius Filtering
    if (longitude !== undefined && latitude !== undefined) {
      filter.location = {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: radiusMeters || 5000,
        },
      };
    }

    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .sort(longitude !== undefined ? undefined : { createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('citizenId', 'displayName photoURL')
        .populate('assignedWorkerId', 'displayName phoneNumber department')
        .lean(),
      Report.countDocuments(filter),
    ]);

    return {
      reports: reports.map((r) => {
        const rep = { ...r, id: r._id.toString() };
        delete rep._id;
        delete rep.__v;
        return rep;
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieve a single report by ID with ownership checks
   */
  async getReportById(caller, reportId) {
    const report = await Report.findById(reportId)
      .populate('citizenId', 'displayName email photoURL')
      .populate('assignedWorkerId', 'displayName phoneNumber department');

    if (!report) {
      throw new NotFoundError('Report not found');
    }

    // Ownership & Scope Verification
    if (caller.role === ROLES.CITIZEN) {
      if (report.citizenId._id.toString() !== caller._id.toString()) {
        throw new ForbiddenError('You are not authorized to view this report');
      }
    } else if (caller.role === ROLES.ADMIN) {
      if (report.department !== caller.department) {
        throw new ForbiddenError('You can only view reports in your assigned department');
      }
    } else if (caller.role === ROLES.WORKER) {
      if (
        report.department !== caller.department &&
        (!report.assignedWorkerId || report.assignedWorkerId._id.toString() !== caller._id.toString())
      ) {
        throw new ForbiddenError('You can only view reports assigned to you or in your department');
      }
    }

    return report;
  }

  /**
   * Assign a field worker to a report
   */
  async assignWorker(caller, reportId, workerId) {
    const report = await Report.findById(reportId);
    if (!report) {
      throw new NotFoundError('Report not found');
    }

    // RBAC: caller must be Admin for this department or Super Admin
    if (caller.role === ROLES.ADMIN && report.department !== caller.department) {
      throw new ForbiddenError(`You can only assign reports within your department (${caller.department})`);
    }

    // Validate worker existence and department match
    const worker = await User.findById(workerId);
    if (!worker) {
      throw new NotFoundError('Target worker not found');
    }

    if (worker.role !== ROLES.WORKER) {
      throw new BadRequestError('User must have the WORKER role to be assigned tasks');
    }

    if (worker.department !== report.department) {
      throw new BadRequestError(
        `Worker belongs to department '${worker.department}', but report is assigned to '${report.department}'`
      );
    }

    report.assignedWorkerId = worker._id;
    report.assignedAt = new Date();
    report.status = REPORT_STATUSES.ASSIGNED;
    await report.save();

    // Increment worker assigned tasks count
    await User.findByIdAndUpdate(worker._id, {
      $inc: { 'stats.tasksAssigned': 1 },
    });

    // Notify citizen that a worker has been assigned
    notificationService.createNotification({
      recipientId: report.citizenId,
      type: NOTIFICATION_TYPES.REPORT_ASSIGNED,
      title: 'Worker Assigned',
      message: `A field technician has been assigned to address your report: "${report.title}".`,
      reportId: report._id,
      data: { workerId: worker._id, department: report.department },
    });

    logger.info(
      {
        reportId: report._id,
        workerId: worker._id,
        assignedBy: caller._id,
      },
      'Report successfully assigned to field worker'
    );

    return report;
  }

  /**
   * Update report status (e.g., IN_PROGRESS, RESOLVED, REJECTED)
   */
  async updateStatus(caller, reportId, updatePayload) {
    const { status, notes, resolutionImages } = updatePayload;

    const report = await Report.findById(reportId);
    if (!report) {
      throw new NotFoundError('Report not found');
    }

    // Scope check
    if (caller.role === ROLES.WORKER) {
      if (!report.assignedWorkerId || report.assignedWorkerId.toString() !== caller._id.toString()) {
        throw new ForbiddenError('You can only update status for tasks assigned directly to you');
      }
    } else if (caller.role === ROLES.ADMIN) {
      if (report.department !== caller.department) {
        throw new ForbiddenError('You can only update reports within your department');
      }
    } else if (caller.role === ROLES.CITIZEN) {
      throw new ForbiddenError('Citizens cannot modify report statuses');
    }

    // Status transition validation
    if (status === REPORT_STATUSES.RESOLVED) {
      report.status = REPORT_STATUSES.RESOLVED;
      report.resolutionProof = {
        images: resolutionImages || [],
        notes: notes || 'Resolved by field team',
        resolvedAt: new Date(),
        resolvedBy: caller._id,
        verifiedByAdmin: caller.role === ROLES.ADMIN || caller.role === ROLES.SUPER_ADMIN,
        verifiedAt: new Date(),
      };

      // Award EcoCoins to citizen if not already awarded
      if (report.ecoCoinsAwarded === 0) {
        const coinsAwarded = REWARD_POINTS.STANDARD_REPORT_RESOLVED;
        report.ecoCoinsAwarded = coinsAwarded;

        // Atomically update citizen points and stats
        await User.findByIdAndUpdate(report.citizenId, {
          $inc: {
            ecoCoins: coinsAwarded,
            'stats.reportsResolved': 1,
          },
        });

        logger.info(
          {
            reportId: report._id,
            citizenId: report.citizenId,
            ecoCoins: coinsAwarded,
          },
          'Awarded EcoCoins to citizen for verified resolution'
        );
      }

      // If resolved by worker, update worker completed count
      if (report.assignedWorkerId) {
        await User.findByIdAndUpdate(report.assignedWorkerId, {
          $inc: { 'stats.tasksCompleted': 1 },
        });
      }
    } else {
      report.status = status;
    }

    await report.save();

    logger.info(
      {
        reportId: report._id,
        status: report.status,
        updatedBy: caller._id,
      },
      'Report status successfully updated'
    );

    return report;
  }
}

module.exports = new ReportService();
