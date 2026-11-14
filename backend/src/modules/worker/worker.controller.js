const workerService = require('./worker.service');
const { successResponse } = require('../../utils/api-response');

class WorkerController {
  /**
   * List tasks assigned to this worker
   */
  async listTasks(req, res, next) {
    try {
      const { tasks, pagination } = await workerService.listWorkerTasks(req.user, req.query);
      return successResponse(res, {
        message: 'Assigned tasks retrieved successfully',
        data: { tasks },
        meta: pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single task details
   */
  async getTaskDetails(req, res, next) {
    try {
      const task = await workerService.getTaskDetails(req.user, req.params.id);
      return successResponse(res, {
        message: 'Task details retrieved successfully',
        data: { task },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark task as IN_PROGRESS
   */
  async startTask(req, res, next) {
    try {
      const task = await workerService.startTask(req.user, req.params.id);
      return successResponse(res, {
        message: 'Task execution started (marked IN_PROGRESS)',
        data: { task },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Submit resolution proof photos and mark task as RESOLVED
   */
  async resolveTask(req, res, next) {
    try {
      const task = await workerService.resolveTask(req.user, req.params.id, req.body);
      return successResponse(res, {
        message: 'Task successfully resolved with verification proof',
        data: { task },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get worker operational stats
   */
  async getStats(req, res, next) {
    try {
      const stats = await workerService.getWorkerStats(req.user);
      return successResponse(res, {
        message: 'Worker performance statistics retrieved successfully',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WorkerController();
