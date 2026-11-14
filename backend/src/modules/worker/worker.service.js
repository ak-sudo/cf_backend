const Report = require('../reports/report.model');
const User = require('../users/user.model');
const Transaction = require('../rewards/transaction.model');
const {
  REPORT_STATUSES,
  REWARD_POINTS,
  SEVERITY_LEVELS,
} = require('../../constants/reports');
const { REWARD_TRANSACTION_TYPES } = require('../../constants/rewards');
const {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} = require('../../utils/errors');
const notificationService = require('../notifications/notification.service');
const { NOTIFICATION_TYPES } = require('../../constants/notifications');
const logger = require('../../utils/logger');

class WorkerService {
  /**
   * Retrieves tasks assigned to the authenticated field worker
   */
  async listWorkerTasks(worker, query) {
    const { page, limit, status, severity } = query;

    const filter = {
      assignedWorkerId: worker._id,
    };

    if (status) {
      filter.status = status;
    }

    if (severity) {
      filter.severity = severity;
    }

    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      Report.find(filter)
        .sort({ severity: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('citizenId', 'displayName phoneNumber')
        .lean(),
      Report.countDocuments(filter),
    ]);

    return {
      tasks: tasks.map((t) => {
        const item = { ...t, id: t._id.toString() };
        delete item._id;
        delete item.__v;
        return item;
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
   * Retrieve full task details for a worker
   */
  async getTaskDetails(worker, taskId) {
    const task = await Report.findById(taskId)
      .populate('citizenId', 'displayName phoneNumber')
      .lean();

    if (!task) {
      throw new NotFoundError('Assigned task not found');
    }

    // Strict worker ownership verification (Directive Section 5)
    if (!task.assignedWorkerId || task.assignedWorkerId.toString() !== worker._id.toString()) {
      throw new ForbiddenError('You are only authorized to access tasks assigned directly to you');
    }

    const item = { ...task, id: task._id.toString() };
    delete item._id;
    delete item.__v;
    return item;
  }

  /**
   * Mark an assigned task as in progress
   */
  async startTask(worker, taskId) {
    const task = await Report.findById(taskId);

    if (!task) {
      throw new NotFoundError('Assigned task not found');
    }

    if (!task.assignedWorkerId || task.assignedWorkerId.toString() !== worker._id.toString()) {
      throw new ForbiddenError('You can only update tasks assigned directly to you');
    }

    // Idempotent start: if already in progress, return without error
    if (task.status === REPORT_STATUSES.IN_PROGRESS) {
      return task;
    }

    if (task.status === REPORT_STATUSES.RESOLVED || task.status === REPORT_STATUSES.REJECTED) {
      throw new BadRequestError(`Cannot start task in current state: ${task.status}`);
    }

    task.status = REPORT_STATUSES.IN_PROGRESS;
    await task.save();

    // Notify citizen that on-site work has commenced
    notificationService.createNotification({
      recipientId: task.citizenId,
      type: NOTIFICATION_TYPES.REPORT_IN_PROGRESS,
      title: 'Work Commenced',
      message: `On-site resolution work has started for your report: "${task.title}".`,
      reportId: task._id,
    });

    logger.info({ taskId: task._id, workerId: worker._id }, 'Field worker started task execution');
    return task;
  }

  /**
   * Submit resolution proof and complete task
   */
  async resolveTask(worker, taskId, resolutionData) {
    const { resolutionImages, notes, workerCoordinates } = resolutionData;

    const task = await Report.findById(taskId);

    if (!task) {
      throw new NotFoundError('Assigned task not found');
    }

    if (!task.assignedWorkerId || task.assignedWorkerId.toString() !== worker._id.toString()) {
      throw new ForbiddenError('You can only resolve tasks assigned directly to you');
    }

    if (task.status === REPORT_STATUSES.RESOLVED) {
      throw new BadRequestError('This task has already been resolved');
    }

    task.status = REPORT_STATUSES.RESOLVED;
    task.resolutionProof = {
      images: resolutionImages,
      notes,
      resolvedAt: new Date(),
      resolvedBy: worker._id,
      verifiedByAdmin: false,
    };

    // Calculate EcoCoins reward for the reporting citizen
    let coinsToAward = REWARD_POINTS.STANDARD_REPORT_RESOLVED;
    if (task.severity === SEVERITY_LEVELS.HIGH || task.severity === SEVERITY_LEVELS.CRITICAL) {
      coinsToAward += REWARD_POINTS.HIGH_SEVERITY_BONUS;
    }

    // Atomic update of citizen balance and ledger entry (with idempotency!)
    if (task.ecoCoinsAwarded === 0) {
      task.ecoCoinsAwarded = coinsToAward;

      const updatedCitizen = await User.findByIdAndUpdate(
        task.citizenId,
        {
          $inc: {
            ecoCoins: coinsToAward,
            'stats.reportsResolved': 1,
          },
        },
        { new: true }
      );

      if (updatedCitizen) {
        // Record immutable ledger entry
        try {
          await Transaction.create({
            userId: task.citizenId,
            amount: coinsToAward,
            type: REWARD_TRANSACTION_TYPES.EARNED_REPORT_RESOLVED,
            reportId: task._id,
            balanceAfter: updatedCitizen.ecoCoins,
            description: `EcoCoins awarded for resolved report: ${task.title}`,
            metadata: {
              reportId: task._id,
              resolvedByWorkerId: worker._id,
              severity: task.severity,
            },
          });
        } catch (ledgerErr) {
          // Unique index catches any duplicate credit attempt
          logger.warn({ err: ledgerErr.message, reportId: task._id }, 'Ledger entry duplicate prevented');
        }
      }
    }

    await task.save();

    // Increment worker completed count
    await User.findByIdAndUpdate(worker._id, {
      $inc: { 'stats.tasksCompleted': 1 },
    });

    // Notify citizen that the issue has been resolved and EcoCoins awarded
    notificationService.createNotification({
      recipientId: task.citizenId,
      type: NOTIFICATION_TYPES.REPORT_RESOLVED,
      title: 'Issue Resolved! 🎉',
      message: `Your reported issue "${task.title}" has been resolved by our field team. You earned ${coinsToAward} EcoCoins!`,
      reportId: task._id,
      data: {
        coinsAwarded: coinsToAward,
        proofImages: resolutionImages,
      },
    });

    logger.info(
      {
        taskId: task._id,
        workerId: worker._id,
        citizenId: task.citizenId,
        coinsAwarded: coinsToAward,
      },
      'Task resolved by field worker with proof photos'
    );

    return task;
  }

  /**
   * Field worker operational performance statistics
   */
  async getWorkerStats(worker) {
    const counts = await Report.aggregate([
      { $match: { assignedWorkerId: worker._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const stats = {
      assigned: 0,
      inProgress: 0,
      resolved: 0,
      total: 0,
    };

    counts.forEach((c) => {
      stats.total += c.count;
      if (c._id === REPORT_STATUSES.ASSIGNED) stats.assigned = c.count;
      else if (c._id === REPORT_STATUSES.IN_PROGRESS) stats.inProgress = c.count;
      else if (c._id === REPORT_STATUSES.RESOLVED) stats.resolved = c.count;
    });

    const completionRate = stats.total > 0
      ? Math.round((stats.resolved / stats.total) * 100)
      : 100;

    return {
      worker: {
        id: worker._id.toString(),
        displayName: worker.displayName,
        department: worker.department,
      },
      workload: stats,
      completionRatePercent: completionRate,
    };
  }
}

module.exports = new WorkerService();
