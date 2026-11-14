const Report = require('../reports/report.model');
const User = require('../users/user.model');
const { ROLES } = require('../../constants/roles');
const { REPORT_STATUSES } = require('../../constants/reports');
const { getRedisClient } = require('../../config/redis');
const logger = require('../../utils/logger');

class AnalyticsService {
  /**
   * Resolves date filter based on time range string
   */
  resolveDateRange(timeRange, customStart, customEnd) {
    if (customStart || customEnd) {
      const range = {};
      if (customStart) range.$gte = new Date(customStart);
      if (customEnd) range.$lte = new Date(customEnd);
      return range;
    }

    const now = new Date();
    const range = { $lte: now };

    if (timeRange === '7d') {
      range.$gte = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeRange === '30d') {
      range.$gte = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (timeRange === '90d') {
      range.$gte = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (timeRange === 'year') {
      range.$gte = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    } else {
      return null; // 'all' time
    }

    return range;
  }

  /**
   * Enforces department isolation for ADMIN role
   */
  resolveDepartment(caller, requestedDepartment) {
    if (caller.role === ROLES.ADMIN) {
      return caller.department;
    }
    return requestedDepartment || null;
  }

  /**
   * Retrieves high-level operational overview metrics
   */
  async getOverview(caller, filterParams) {
    const { timeRange, startDate, endDate, department } = filterParams;
    const resolvedDept = this.resolveDepartment(caller, department);
    const dateRange = this.resolveDateRange(timeRange, startDate, endDate);

    // Redis Cache Key (Directive Section 8)
    const cacheKey = `analytics:overview:${caller.role}:${resolvedDept || 'all'}:${timeRange || 'custom'}`;
    const redis = getRedisClient();

    if (redis && process.env.NODE_ENV !== 'test') {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        logger.debug({ err: err.message }, 'Redis cache read error in analytics overview');
      }
    }

    const matchStage = {};
    if (resolvedDept) matchStage.department = resolvedDept;
    if (dateRange) matchStage.createdAt = dateRange;

    const [statusStats, resolutionTimes, activeWorkers] = await Promise.all([
      Report.aggregate([
        { $match: matchStage },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Report.aggregate([
        {
          $match: {
            ...matchStage,
            status: REPORT_STATUSES.RESOLVED,
            'resolutionProof.resolvedAt': { $exists: true, $ne: null },
          },
        },
        {
          $project: {
            durationHours: {
              $divide: [
                { $subtract: ['$resolutionProof.resolvedAt', '$createdAt'] },
                1000 * 60 * 60,
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgResolutionTimeHours: { $avg: '$durationHours' },
          },
        },
      ]),
      User.countDocuments({
        role: ROLES.WORKER,
        isActive: true,
        ...(resolvedDept ? { department: resolvedDept } : {}),
      }),
    ]);

    const statusCounts = {
      submitted: 0,
      assigned: 0,
      inProgress: 0,
      resolved: 0,
      rejected: 0,
      pendingReview: 0,
      total: 0,
    };

    statusStats.forEach((s) => {
      statusCounts.total += s.count;
      if (s._id === REPORT_STATUSES.SUBMITTED) statusCounts.submitted = s.count;
      else if (s._id === REPORT_STATUSES.ASSIGNED) statusCounts.assigned = s.count;
      else if (s._id === REPORT_STATUSES.IN_PROGRESS) statusCounts.inProgress = s.count;
      else if (s._id === REPORT_STATUSES.RESOLVED) statusCounts.resolved = s.count;
      else if (s._id === REPORT_STATUSES.REJECTED) statusCounts.rejected = s.count;
      else if (s._id === REPORT_STATUSES.PENDING_REVIEW) statusCounts.pendingReview = s.count;
    });

    const resolutionRatePercent = statusCounts.total > 0
      ? Math.round((statusCounts.resolved / statusCounts.total) * 100)
      : 100;

    const avgResolutionTimeHours = resolutionTimes.length > 0 && resolutionTimes[0].avgResolutionTimeHours
      ? Math.round(resolutionTimes[0].avgResolutionTimeHours * 10) / 10
      : 0;

    const result = {
      department: resolvedDept || 'ALL_DEPARTMENTS',
      timeRange: timeRange || 'custom',
      metrics: {
        totalReports: statusCounts.total,
        statusBreakdown: statusCounts,
        resolutionRatePercent,
        avgResolutionTimeHours,
        activeWorkersCount: activeWorkers,
      },
    };

    // Cache for 5 minutes in Redis
    if (redis && process.env.NODE_ENV !== 'test') {
      try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
      } catch (err) {
        logger.debug({ err: err.message }, 'Redis cache write error');
      }
    }

    return result;
  }

  /**
   * Aggregates reports by category with severity distributions
   */
  async getCategoryBreakdown(caller, filterParams) {
    const { timeRange, startDate, endDate, department } = filterParams;
    const resolvedDept = this.resolveDepartment(caller, department);
    const dateRange = this.resolveDateRange(timeRange, startDate, endDate);

    const matchStage = {};
    if (resolvedDept) matchStage.department = resolvedDept;
    if (dateRange) matchStage.createdAt = dateRange;

    const categories = await Report.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$category',
          total: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ['$status', REPORT_STATUSES.RESOLVED] }, 1, 0] },
          },
          inProgress: {
            $sum: { $cond: [{ $eq: ['$status', REPORT_STATUSES.IN_PROGRESS] }, 1, 0] },
          },
        },
      },
      { $sort: { total: -1 } },
    ]);

    return {
      department: resolvedDept || 'ALL_DEPARTMENTS',
      categories: categories.map((c) => ({
        category: c._id,
        total: c.total,
        resolved: c.resolved,
        inProgress: c.inProgress,
        resolutionRatePercent: c.total > 0 ? Math.round((c.resolved / c.total) * 100) : 100,
      })),
    };
  }

  /**
   * Retrieves lightweight coordinates data for GIS map and heatmap rendering
   */
  async getHeatmapPoints(caller, queryParams) {
    const { department, status, category, longitude, latitude, radiusMeters, limit } = queryParams;
    const resolvedDept = this.resolveDepartment(caller, department);

    const matchStage = {};
    if (resolvedDept) matchStage.department = resolvedDept;
    if (status) matchStage.status = status;
    if (category) matchStage.category = category;

    // Radius filter if coordinates specified
    if (longitude !== undefined && latitude !== undefined) {
      matchStage.location = {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: radiusMeters,
        },
      };
    }

    const points = await Report.find(matchStage)
      .select('location.coordinates category severity status createdAt')
      .limit(limit)
      .lean();

    return {
      department: resolvedDept || 'ALL_DEPARTMENTS',
      totalPoints: points.length,
      points: points.map((p) => ({
        id: p._id.toString(),
        coordinates: p.location.coordinates,
        category: p.category,
        severity: p.severity,
        status: p.status,
        createdAt: p.createdAt,
      })),
    };
  }

  /**
   * Retrieves worker performance and workload distribution for department
   */
  async getWorkerLeaderboard(caller) {
    const resolvedDept = caller.role === ROLES.ADMIN ? caller.department : null;

    const workerFilter = { role: ROLES.WORKER, isActive: true };
    if (resolvedDept) workerFilter.department = resolvedDept;

    const workers = await User.find(workerFilter)
      .select('displayName phoneNumber department stats')
      .sort({ 'stats.tasksCompleted': -1 })
      .limit(50)
      .lean();

    return {
      department: resolvedDept || 'ALL_DEPARTMENTS',
      workers: workers.map((w) => ({
        id: w._id.toString(),
        displayName: w.displayName,
        department: w.department,
        tasksAssigned: w.stats?.tasksAssigned || 0,
        tasksCompleted: w.stats?.tasksCompleted || 0,
        completionRatePercent:
          w.stats?.tasksAssigned > 0
            ? Math.round(((w.stats.tasksCompleted || 0) / w.stats.tasksAssigned) * 100)
            : 100,
      })),
    };
  }
}

module.exports = new AnalyticsService();
