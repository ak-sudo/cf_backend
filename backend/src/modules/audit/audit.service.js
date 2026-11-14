const AuditLog = require('./audit.model');
const logger = require('../../utils/logger');

class AuditService {
  /**
   * Log an administrative or security-sensitive action into the immutable audit trail
   */
  async recordAction({
    actorId,
    actorEmail = '',
    actorRole,
    action,
    targetResource,
    targetId = '',
    changes = {},
    ipAddress = '',
    userAgent = '',
  }) {
    try {
      const entry = await AuditLog.create({
        actorId,
        actorEmail,
        actorRole,
        action,
        targetResource,
        targetId,
        changes,
        ipAddress,
        userAgent,
      });

      logger.info(
        {
          auditId: entry._id,
          actorId,
          action,
          targetResource,
          targetId,
        },
        'Privileged action recorded in system audit trail'
      );

      return entry;
    } catch (err) {
      logger.error({ err: err.message, action, targetResource }, 'Failed to record audit log entry');
      return null;
    }
  }

  /**
   * Paginated audit log search (Strictly restricted to SUPER_ADMIN)
   */
  async listLogs(query) {
    const {
      page = 1,
      limit = 25,
      action,
      targetResource,
      actorId,
      startDate,
      endDate,
    } = query;

    const filter = {};

    if (action) filter.action = action;
    if (targetResource) filter.targetResource = targetResource;
    if (actorId) filter.actorId = actorId;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actorId', 'displayName email role')
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return {
      logs: logs.map((l) => {
        const item = { ...l, id: l._id.toString() };
        delete item._id;
        delete item.__v;
        return item;
      }),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

module.exports = new AuditService();
